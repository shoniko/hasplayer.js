Mss.dependencies.MssParser = function () {
    "use strict";

    var numericRegex = /^[-+]?[0-9]+[.]?[0-9]*([eE][-+]?[0-9]+)?$/;

    var matchers = [
        {
            type: "numeric",
            test: function (str) {
                return numericRegex.test(str);
            },
            converter: function (str) {
                return parseFloat(str);
            }
        }
    ];

    var getCommonValuesMap = function () {
        var adaptationSet,
            representation,
            subRepresentation,
            common;

        //use by parser to copy all common attributes between adaptation and representation
        common = [
            {
                name: 'profiles',
                merge: false
            },
            {
                name: 'width',
                merge: false
            },
            {
                name: 'height',
                merge: false
            },
            {
                name: 'sar',
                merge: false
            },
            {
                name: 'frameRate',
                merge: false
            },
            {
                name: 'audioSamplingRate',
                merge: false
            },
            {
                name: 'mimeType',
                merge: false
            },
            {
                name: 'segmentProfiles',
                merge: false
            },
            {
                name: 'codecs',
                merge: false
            },
            {
                name: 'maximumSAPPeriod',
                merge: false
            },
            {
                name: 'startsWithSap',
                merge: false
            },
            {
                name: 'maxPlayoutRate',
                merge: false
            },
            {
                name: 'codingDependency',
                merge: false
            },
            {
                name: 'scanType',
                merge: false
            },
            {
                name: 'FramePacking',
                merge: true
            },
            {
                name: 'AudioChannelConfiguration',
                merge: true
            },
            {
                name: 'ContentProtection',
                merge: true
            }
        ];

        adaptationSet = {};
        adaptationSet.name = "AdaptationSet";
        adaptationSet.isRoot = false;
        adaptationSet.isArray = true;
        adaptationSet.parent = null;
        adaptationSet.children = [];
        adaptationSet.properties = common;
        

        representation = {};
        representation.name = "Representation";
        representation.isRoot = false;
        representation.isArray = true;
        representation.parent = adaptationSet;
        representation.children = [];
        representation.properties = common;
        adaptationSet.children.push(representation);
/*
        subRepresentation = {};
        subRepresentation.name = "SubRepresentation";
        subRepresentation.isRoot = false;
        subRepresentation.isArray = true;
        subRepresentation.parent = representation;
        subRepresentation.children = [];
        subRepresentation.properties = common;
        representation.children.push(subRepresentation);*/

        return adaptationSet;
    };

    var getSegmentValuesMap = function () {
        var period,
            adaptationSet,
            representation,
            common;

        common = [
            {
                name: 'SegmentBase',
                merge: true
            },
            {
                name: 'SegmentTemplate',
                merge: true
            },
            {
                name: 'SegmentList',
                merge: true
            }
        ];

        period = {};
        period.name = "Period";
        period.isRoot = false;
        period.isArray = false;
        period.parent = null;
        period.children = [];
        period.properties = common;

        adaptationSet = {};
        adaptationSet.name = "AdaptationSet";
        adaptationSet.isRoot = false;
        adaptationSet.isArray = true;
        adaptationSet.parent = period;
        adaptationSet.children = [];
        adaptationSet.properties = common;
        period.children.push(adaptationSet);

        representation = {};
        representation.name = "Representation";
        representation.isRoot = false;
        representation.isArray = true;
        representation.parent = adaptationSet;
        representation.children = [];
        representation.properties = common;
        adaptationSet.children.push(representation);

        return period;
    };

    var getBaseUrlValuesMap = function () {
        var mpd,
            period,
            adaptationSet,
            representation,
            segmentTemplate,
            segmentTimeline,
            segment,
            common;

        common = [
            {
                name: 'BaseURL',
                merge: true,
                mergeFunction: function (parentValue, childValue) {
                    var mergedValue;

                    // child is absolute, don't merge
                    if (childValue.indexOf("http://") === 0) {
                        mergedValue = childValue;
                    } else {
                        mergedValue = parentValue + childValue;
                    }

                    return mergedValue;
                }
        }];

        mpd = {};
        mpd.name = "mpd";
        mpd.isRoot = true;
        mpd.isArray = true;
        mpd.parent = null;
        mpd.children = [];
        mpd.properties = common;
        mpd.transformFunc = function(node) {
            if(this.isTransformed) {
                return node;
            }
            this.isTransformed = true;
            return {
                profiles: "urn:mpeg:dash:profile:isoff-live:2011",
                type: node.isLive ? "dynamic" : "static",
                timeShiftBufferDepth: node.DVRWindowLength,
                mediaPresentationDuration : node.Duration,
                BaseURL: node.BaseURL,
                Period: node,
                Period_asArray: [node]
            };
        };
        mpd.isTransformed = false;

        period = {};
        period.name = "Period";
        period.isRoot = false;
        period.isArray = false;
        period.parent = null;
        period.children = [];
        period.properties = common;
        // here node is SmoothStreamingMedia node
        period.transformFunc = function(node) {
            return {
                duration: node.Duration,
                BaseURL: node.BaseURL,
                AdaptationSet: node.StreamIndex,
                AdaptationSet_asArray: node.StreamIndex_asArray
            };
        };
        mpd.children.push(period);

        adaptationSet = {};
        adaptationSet.name = "AdaptationSet";
        adaptationSet.isRoot = false;
        adaptationSet.isArray = true;
        adaptationSet.parent = period;
        adaptationSet.children = [];
        adaptationSet.properties = common;
        //here node is StreamIndex node
        adaptationSet.transformFunc = function(node) {
            return {
                id: node.Name,
                lang: node.Language,
                contenType: node.Type,
                mimeType: node.Type == "video" ? "video/mp4" : "audio/mp4",
                maxWidth: node.MaxWidth,
                maxHeight: node.MaxHeight,
                BaseURL: node.BaseURL,
                Representation: node.QualityLevel,
                Representation_asArray: node.QualityLevel_asArray,
                SegmentTemplate : node,
                SegmentTemplate_asArray : [node]
            };
        };
        period.children.push(adaptationSet);

        representation = {};
        representation.name = "Representation";
        representation.isRoot = false;
        representation.isArray = true;
        representation.parent = adaptationSet;
        representation.children = [];
        representation.properties = common;
        //here node is QualityLevel
        representation.transformFunc = function(node) {
            // extraction of the codec find the first 00000001x7
            var nalHeader = /00000001[0-9]7/.exec(node.CodecPrivateData);
            // find the 6 characters after the first nalHeader (if it exists)
            var avcoti = nalHeader && nalHeader[0] ? (node.CodecPrivateData.substr(node.CodecPrivateData.indexOf(nalHeader[0])+10, 6)) : undefined;
            var codecs = avcoti? "avc1."+avcoti : undefined;

            //TODO get the audio codec for an audio representation

            return {
                id: node.Index,
                bandwidth: node.Bitrate,
                width: node.maxWidth,
                height: node.maxHeight,
                codecs: codecs,
                audioSamplingRate: node.SamplingRate,
                codecPrivateData: node.CodecPrivateData,
                BaseURL: node.BaseURL
            };
        };
        adaptationSet.children.push(representation);

        segmentTemplate = {};
        segmentTemplate.name = "SegmentTemplate";
        segmentTemplate.isRoot = false;
        segmentTemplate.isArray = false;
        segmentTemplate.parent = adaptationSet;
        segmentTemplate.children = [];
        segmentTemplate.properties = common;
        //here node is QualityLevel
        segmentTemplate.transformFunc = function(node) {
            return {
                media: node.Url,
                duration: node.Duration,
                timescale: node.timeScale,
                SegmentTimeline: node
            };
        };
        adaptationSet.children.push(segmentTemplate);


        segmentTimeline = {};
        segmentTimeline.name = "SegmentTimeline";
        segmentTimeline.isRoot = false;
        segmentTimeline.isArray = false;
        segmentTimeline.parent = segmentTemplate;
        segmentTimeline.children = [];
        segmentTimeline.properties = common;
        //here node is QualityLevel
        segmentTimeline.transformFunc = function(node) {
            return {
                S: node.c,
                S_asArray: node.c_asArray
            };
        };
        segmentTemplate.children.push(segmentTimeline);

        segment = {};
        segment.name = "S";
        segment.isRoot = false;
        segment.isArray = true;
        segment.parent = segmentTimeline;
        segment.children = [];
        segment.properties = common;
        //here node is QualityLevel
        segment.transformFunc = function(node) {
            return {
                d: node.d,
                r: node.r
            };
        };
        segmentTimeline.children.push(segment);
        
        return mpd;
    };

    var getDashMap = function () {
        var result = [];

        result.push(getCommonValuesMap());
        result.push(getSegmentValuesMap());
        result.push(getBaseUrlValuesMap());

        return result;
    };





    var internalParse = function(data, baseUrl) {
        this.logger.debug("[MssParser]", "Doing parse.");
        
        var manifest = null;
        var converter = new X2JS(matchers, '', true);
        var iron = new Custom.utils.ObjectIron(getDashMap());
 
        this.logger.debug("[MssParser]", "Converting from XML.");
        manifest = converter.xml_str2json(data);

        if (manifest === null) {
            this.logger.error("[MssParser]", "Failed to parse manifest!!");
            return Q.when(null);
        }

        // set the baseUrl
        if (!manifest.hasOwnProperty("BaseURL")) {
            this.logger.debug("[DashParser]", "Setting baseURL: " + baseUrl);
            manifest.BaseURL = baseUrl;
        } else {
            // Setting manifest's BaseURL to the first BaseURL
            manifest.BaseURL = manifest.BaseURL_asArray[0];

            if (manifest.BaseURL.indexOf("http") !== 0) {
                manifest.BaseURL = baseUrl + manifest.BaseURL;
            }
        }

        this.logger.debug("[MssParser]", "Flatten manifest properties.");
        manifest = iron.run(manifest);

        this.logger.debug("[MssParser]", "Parsing complete.")
        return Q.when(manifest);
    };

    return {
        logger: undefined,
                
        parse: internalParse
    };
};

Mss.dependencies.MssParser.prototype =  {
    constructor: Mss.dependencies.MssParser
};
