function(props) {
    const libraries = props && props.context && props.context.libraries ? props.context.libraries : {};
    const React = libraries.react;
    if (!React) return null;

    const ReactNative = libraries["react-native"] || {};
    const View = ReactNative.View;
    const Text = ReactNative.Text;
    const Pressable = ReactNative.Pressable || ReactNative.TouchableOpacity;
    const PanResponder = ReactNative.PanResponder;
    const SvgModule = libraries["react-native-svg"] || {};
    const Svg = SvgModule.Svg || SvgModule.default;
    const Path = SvgModule.Path;
    const Rect = SvgModule.Rect;
    const SvgImage = SvgModule.Image;
    const instance = props && props.instance ? props.instance : {};

    if (instance && !instance.data) instance.data = {};

    function readProperty(source, name, fallback) {
        let value = source ? source[name] : undefined;
        if (typeof value === "function") {
            try {
                value = value();
            } catch (_error) {
                value = fallback;
            }
        }
        return value === undefined || value === null ? fallback : value;
    }

    function readText(source, name, fallback) {
        let value = readProperty(source, name, fallback);
        if (value === undefined || value === null) return fallback;
        if (typeof value === "object") {
            if (typeof value.url === "function") {
                try {
                    value = value.url();
                } catch (_error) {
                    value = fallback;
                }
            } else if (typeof value.url === "string") {
                value = value.url;
            } else if (typeof value.value === "string") {
                value = value.value;
            } else {
                value = fallback;
            }
        }
        return String(value);
    }

    function readBoolean(source, name, fallback) {
        let value = readProperty(source, name, fallback);
        if (value === undefined || value === null || value === "") return !!fallback;
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        value = String(value).toLowerCase().trim();
        if (value === "false" || value === "no" || value === "0") return false;
        if (value === "true" || value === "yes" || value === "1") return true;
        return !!fallback;
    }

    function readNumber(source, name, fallback, min, max) {
        let value = Number(readProperty(source, name, fallback));
        if (!Number.isFinite(value)) value = Number(fallback);
        if (Number.isFinite(min)) value = Math.max(min, value);
        if (Number.isFinite(max)) value = Math.min(max, value);
        return value;
    }

    function readColor(source, name, fallback) {
        const value = readProperty(source, name, fallback);
        return value ? String(value) : fallback;
    }

    function buildConfig(source) {
        let outputFormat = readText(source, "output_format", "png").toLowerCase();
        if (outputFormat !== "jpeg") outputFormat = "png";

        let commitBehavior = readText(source, "commit_behavior", "on_stroke_end").toLowerCase();
        if (commitBehavior !== "manual") commitBehavior = "on_stroke_end";

        const minWidth = readNumber(source, "min_width", 0.5, 0.1, 50);
        const maxWidth = Math.max(minWidth, readNumber(source, "max_width", 2.5, minWidth, 50));

        return {
            initialSignature: readText(source, "initial_signature", ""),
            enabled: readBoolean(source, "enabled", true),
            commitBehavior,
            commitDelayMs: Math.round(readNumber(source, "commit_delay_ms", 500, 0, 10000)),
            fileNamePrefix: readText(source, "file_name_prefix", "signature") || "signature",
            outputFormat,
            jpegQuality: readNumber(source, "jpeg_quality", 0.92, 0, 1),
            penColor: readColor(source, "pen_color", "#111827"),
            minWidth,
            maxWidth,
            backgroundColor: readColor(source, "background_color", "#ffffff"),
            minDistance: readNumber(source, "min_distance", 5, 0, 50),
            throttleMs: Math.round(readNumber(source, "throttle_ms", 16, 0, 1000)),
            placeholderText: readText(source, "placeholder_text", "Sign here"),
            showToolbar: readBoolean(source, "show_toolbar", true),
            showClearButton: readBoolean(source, "show_clear_button", true),
            showUndoButton: readBoolean(source, "show_undo_button", true),
            showSaveButton: readBoolean(source, "show_save_button", true),
            clearButtonLabel: readText(source, "clear_button_label", "Clear"),
            undoButtonLabel: readText(source, "undo_button_label", "Undo"),
            saveButtonLabel: readText(source, "save_button_label", "Save"),
            toolbarBackgroundColor: readColor(source, "toolbar_background_color", "#f8fafc"),
            buttonBackgroundColor: readColor(source, "button_background_color", "#ffffff"),
            buttonTextColor: readColor(source, "button_text_color", "#111827"),
            buttonBorderColor: readColor(source, "button_border_color", "#cbd5e1")
        };
    }

    const baseConfig = buildConfig(props || {});
    const [enabledOverride, setEnabledOverride] = React.useState(null);
    const config = Object.assign({}, baseConfig, {
        enabled: enabledOverride === null ? baseConfig.enabled : enabledOverride
    });
    const configRef = React.useRef(config);
    const contextRef = React.useRef(props && props.context ? props.context : {});
    const svgRef = React.useRef(null);
    const commitTimerRef = React.useRef(null);
    const lastMoveAtRef = React.useRef(0);
    const currentStrokeRef = React.useRef([]);
    const strokesRef = React.useRef([]);
    const initialImageUriRef = React.useRef("");
    const layoutRef = React.useRef({ width: 1, height: 1 });
    const [layout, setLayout] = React.useState({ width: 1, height: 1 });
    const [strokes, setStrokes] = React.useState([]);
    const [currentStroke, setCurrentStroke] = React.useState([]);
    const [initialImageUri, setInitialImageUri] = React.useState("");
    const [isUploading, setIsUploading] = React.useState(false);

    configRef.current = config;
    contextRef.current = props && props.context ? props.context : {};

    function safePublishState(name, value) {
        try {
            if (instance && typeof instance.publishState === "function") {
                instance.publishState(name, value);
            }
        } catch (_error) {
            // Bubble mobile instances can be torn down while async callbacks finish.
        }
    }

    function safePublishAutobinding(value) {
        try {
            if (instance && typeof instance.publishAutobinding === "function") {
                instance.publishAutobinding(value);
            }
        } catch (_error) {
            // Autobinding can be absent in some native preview runtimes.
        }
    }

    function safeTrigger(name) {
        try {
            if (instance && typeof instance.triggerEvent === "function") {
                instance.triggerEvent(name);
            }
        } catch (_error) {
            // Ignore page transition races.
        }
    }

    function setError(message) {
        safePublishState("last_error", message || "");
        if (message) safeTrigger("signature_error");
    }

    function hasAnySignature() {
        return !!initialImageUriRef.current || strokesRef.current.length > 0 || currentStrokeRef.current.length > 0;
    }

    function setStrokesBoth(nextStrokes) {
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
    }

    function setCurrentStrokeBoth(nextStroke) {
        currentStrokeRef.current = nextStroke;
        setCurrentStroke(nextStroke);
    }

    function setInitialImageBoth(uri) {
        initialImageUriRef.current = uri || "";
        setInitialImageUri(uri || "");
    }

    function clearCommitTimer() {
        if (commitTimerRef.current) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    }

    function sanitizePrefix(value) {
        const sanitized = String(value || "signature").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
        return sanitized || "signature";
    }

    function fileNameForConfig() {
        return sanitizePrefix(configRef.current.fileNamePrefix) + "-" + Date.now() + ".png";
    }

    function stripDataUrlPrefix(value) {
        const text = String(value || "");
        const commaIndex = text.indexOf(",");
        return commaIndex >= 0 ? text.slice(commaIndex + 1) : text;
    }

    function makeDataUrl(base64) {
        const value = String(base64 || "");
        if (/^data:image\//i.test(value)) return value;
        return "data:image/png;base64," + value;
    }

    function uploadWithContext(base64, fileName) {
        return new Promise(function(resolve, reject) {
            const uploadContext = contextRef.current || {};
            if (!uploadContext || typeof uploadContext.uploadContent !== "function") {
                reject(new Error("No Bubble file upload utility is available in this mobile runtime."));
                return;
            }

            let settled = false;
            function done(err, url) {
                if (settled) return;
                settled = true;
                if (err) {
                    reject(err);
                    return;
                }
                resolve(url || "");
            }

            try {
                const result = uploadContext.uploadContent(fileName, stripDataUrlPrefix(base64), done);
                if (result && typeof result.then === "function") {
                    result.then(function(url) {
                        done(null, url);
                    }).catch(done);
                } else if (typeof result === "string") {
                    done(null, result);
                }
            } catch (error) {
                done(error);
            }
        });
    }

    function exportSignature(callback) {
        if (!hasAnySignature()) {
            callback({ isEmpty: true, dataUrl: "", base64: "" });
            return;
        }

        const svg = svgRef.current;
        if (!svg || typeof svg.toDataURL !== "function") {
            setError("react-native-svg export is unavailable in this runtime.");
            callback(null);
            return;
        }

        try {
            svg.toDataURL(function(base64) {
                const dataUrl = makeDataUrl(base64);
                callback({
                    isEmpty: false,
                    dataUrl,
                    base64: stripDataUrlPrefix(dataUrl)
                });
            }, {
                width: Math.max(1, Math.round(layoutRef.current.width)),
                height: Math.max(1, Math.round(layoutRef.current.height))
            });
        } catch (error) {
            setError(error && error.message ? error.message : "Unable to export signature image.");
            callback(null);
        }
    }

    function publishSnapshot(triggerChanged) {
        exportSignature(function(result) {
            if (!result) return;
            safePublishState("signature_data_url", result.dataUrl || "");
            safePublishState("is_empty", !!result.isEmpty);
            safePublishState("stroke_count", strokesRef.current.length);
            safePublishState("last_error", "");
            if (triggerChanged) safeTrigger("signature_changed");
        });
    }

    function scheduleSnapshot(triggerChanged, delay) {
        setTimeout(function() {
            publishSnapshot(triggerChanged);
        }, delay === undefined ? 40 : delay);
    }

    function saveSignature() {
        clearCommitTimer();
        if (!hasAnySignature()) {
            setError("Signature is empty.");
            return;
        }
        if (isUploading) return;

        setIsUploading(true);
        safePublishState("is_uploading", true);

        exportSignature(function(result) {
            if (!result || result.isEmpty) {
                setIsUploading(false);
                safePublishState("is_uploading", false);
                if (result && result.isEmpty) setError("Signature is empty.");
                return;
            }

            safePublishState("signature_data_url", result.dataUrl);
            uploadWithContext(result.base64, fileNameForConfig()).then(function(url) {
                if (!url) throw new Error("Bubble returned an empty upload URL.");
                safePublishState("value", url);
                safePublishAutobinding(url);
                safePublishState("last_error", "");
                safeTrigger("signature_saved");
            }).catch(function(error) {
                setError(error && error.message ? error.message : "Unable to upload signature image.");
            }).then(function() {
                setIsUploading(false);
                safePublishState("is_uploading", false);
            });
        });
    }

    function scheduleCommit() {
        clearCommitTimer();
        if (configRef.current.commitBehavior !== "on_stroke_end") return;
        if (!hasAnySignature()) return;
        commitTimerRef.current = setTimeout(function() {
            saveSignature();
        }, configRef.current.commitDelayMs);
    }

    function clearSignature() {
        clearCommitTimer();
        setInitialImageBoth("");
        setStrokesBoth([]);
        setCurrentStrokeBoth([]);
        safePublishState("value", null);
        safePublishAutobinding(null);
        safePublishState("signature_data_url", "");
        safePublishState("is_empty", true);
        safePublishState("is_drawing", false);
        safePublishState("stroke_count", 0);
        safePublishState("last_error", "");
        safeTrigger("signature_cleared");
    }

    function undoLastStroke() {
        if (!strokesRef.current.length) return;
        const nextStrokes = strokesRef.current.slice(0, -1);
        setStrokesBoth(nextStrokes);
        scheduleSnapshot(true);
        scheduleCommit();
    }

    function setEnabled(enabled) {
        setEnabledOverride(readBoolean({ enabled }, "enabled", true));
    }

    function clampPoint(point) {
        const width = Math.max(1, layoutRef.current.width);
        const height = Math.max(1, layoutRef.current.height);
        return {
            x: Math.max(0, Math.min(width, point.x)),
            y: Math.max(0, Math.min(height, point.y)),
            time: point.time || Date.now()
        };
    }

    function pointFromEvent(event) {
        const native = event && event.nativeEvent ? event.nativeEvent : {};
        const x = Number.isFinite(native.locationX) ? native.locationX : 0;
        const y = Number.isFinite(native.locationY) ? native.locationY : 0;
        return clampPoint({ x, y, time: Date.now() });
    }

    function shouldAddPoint(point) {
        const stroke = currentStrokeRef.current;
        if (!stroke.length) return true;
        const last = stroke[stroke.length - 1];
        const minDistance = Math.max(0, Number(configRef.current.minDistance) || 0);
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        return dx * dx + dy * dy >= minDistance * minDistance;
    }

    function beginStroke(event) {
        if (!configRef.current.enabled) return;
        const point = pointFromEvent(event);
        setCurrentStrokeBoth([point]);
        lastMoveAtRef.current = Date.now();
        safePublishState("is_drawing", true);
        safePublishState("is_empty", false);
        safePublishState("last_error", "");
        safeTrigger("signature_started");
    }

    function moveStroke(event) {
        if (!configRef.current.enabled || !currentStrokeRef.current.length) return;
        const now = Date.now();
        const throttleMs = Math.max(0, Number(configRef.current.throttleMs) || 0);
        if (throttleMs && now - lastMoveAtRef.current < throttleMs) return;

        const point = pointFromEvent(event);
        if (!shouldAddPoint(point)) return;

        lastMoveAtRef.current = now;
        const nextStroke = currentStrokeRef.current.concat(point);
        setCurrentStrokeBoth(nextStroke);
    }

    function endStroke() {
        const stroke = currentStrokeRef.current;
        if (!stroke.length) {
            safePublishState("is_drawing", false);
            return;
        }

        const nextStrokes = strokesRef.current.concat([stroke]);
        setStrokesBoth(nextStrokes);
        setCurrentStrokeBoth([]);
        safePublishState("is_drawing", false);
        safePublishState("stroke_count", nextStrokes.length);
        safeTrigger("signature_ended");
        scheduleSnapshot(true);
        scheduleCommit();
    }

    const panResponder = React.useMemo(function() {
        if (!PanResponder) return null;
        return PanResponder.create({
            onStartShouldSetPanResponder: function() {
                return !!configRef.current.enabled;
            },
            onStartShouldSetPanResponderCapture: function() {
                return !!configRef.current.enabled;
            },
            onMoveShouldSetPanResponder: function() {
                return !!configRef.current.enabled;
            },
            onMoveShouldSetPanResponderCapture: function() {
                return !!configRef.current.enabled;
            },
            onPanResponderGrant: beginStroke,
            onPanResponderMove: moveStroke,
            onPanResponderRelease: endStroke,
            onPanResponderTerminate: endStroke,
            onPanResponderTerminationRequest: function() {
                return false;
            },
            onShouldBlockNativeResponder: function() {
                return true;
            }
        });
    }, []);

    React.useEffect(function() {
        safePublishState("value", null);
        safePublishState("signature_data_url", "");
        safePublishState("is_empty", true);
        safePublishState("is_drawing", false);
        safePublishState("is_uploading", false);
        safePublishState("stroke_count", 0);
        safePublishState("last_error", "");

        return function() {
            clearCommitTimer();
        };
    }, []);

    React.useEffect(function() {
        setEnabledOverride(null);
    }, [baseConfig.enabled]);

    React.useEffect(function() {
        const source = config.initialSignature || "";
        setInitialImageBoth(source);
        if (source) {
            safePublishState("is_empty", false);
            if (/^data:image\//i.test(source)) {
                safePublishState("signature_data_url", source);
            } else if (/^https?:\/\//i.test(source)) {
                safePublishState("value", source);
                safePublishAutobinding(source);
            }
        } else if (!strokesRef.current.length) {
            safePublishState("signature_data_url", "");
            safePublishState("is_empty", true);
        }
    }, [config.initialSignature]);

    if (instance && instance.data) {
        instance.data.omniSignatureMobileRuntime = {
            helpers: {
                saveSignature,
                clearSignature,
                undoLastStroke,
                setEnabled
            }
        };
    }

    if (!View || !Text || !Svg || !Path || !Rect || !PanResponder) {
        const missing = !PanResponder ? "PanResponder" : "react-native-svg";
        setError(missing + " is unavailable in this Bubble mobile runtime.");
        return View && Text ? (
            <View
                style={{
                    minHeight: 120,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: config.backgroundColor,
                    padding: 12
                }}
            >
                <Text style={{ color: "#b91c1c", textAlign: "center" }}>
                    Signature capture unavailable
                </Text>
            </View>
        ) : null;
    }

    function pointsToPath(points) {
        if (!points || !points.length) return "";
        if (points.length === 1) {
            return "M " + points[0].x + " " + points[0].y + " L " + (points[0].x + 0.1) + " " + points[0].y;
        }

        let d = "M " + points[0].x + " " + points[0].y;
        for (let i = 1; i < points.length - 1; i += 1) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            d += " Q " + points[i].x + " " + points[i].y + " " + midX + " " + midY;
        }
        const last = points[points.length - 1];
        d += " L " + last.x + " " + last.y;
        return d;
    }

    function renderStroke(points, key) {
        const d = pointsToPath(points);
        if (!d) return null;
        return (
            <Path
                key={key}
                d={d}
                fill="none"
                stroke={config.penColor}
                strokeWidth={Math.max(0.1, (config.minWidth + config.maxWidth) / 2)}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    }

    const disabled = !config.enabled || isUploading;
    const ButtonComponent = Pressable || Text;
    const svgWidth = Math.max(1, layout.width);
    const svgHeight = Math.max(1, layout.height);
    const empty = !initialImageUri && !strokes.length && !currentStroke.length;

    function renderButton(key, label, visible, onPress) {
        if (!visible) return null;
        return (
            <ButtonComponent
                key={key}
                disabled={disabled}
                onPress={disabled ? undefined : onPress}
                style={{
                    minHeight: 32,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: config.buttonBorderColor,
                    backgroundColor: config.buttonBackgroundColor,
                    opacity: disabled ? 0.55 : 1,
                    marginLeft: 8,
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Text
                    style={{
                        color: config.buttonTextColor,
                        fontSize: 14,
                        lineHeight: 18
                    }}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </ButtonComponent>
        );
    }

    const toolbarChildren = [
        renderButton("undo", config.undoButtonLabel, config.showUndoButton, undoLastStroke),
        renderButton("clear", config.clearButtonLabel, config.showClearButton, clearSignature),
        renderButton("save", config.saveButtonLabel, config.showSaveButton, saveSignature)
    ].filter(Boolean);

    return (
        <View
            style={{
                flex: 1,
                width: "100%",
                minHeight: 120,
                backgroundColor: config.backgroundColor,
                overflow: "hidden",
                opacity: config.enabled ? 1 : 0.72
            }}
        >
            <View
                {...(panResponder ? panResponder.panHandlers : {})}
                collapsable={false}
                onLayout={function(event) {
                    const nextLayout = event && event.nativeEvent && event.nativeEvent.layout ? event.nativeEvent.layout : {};
                    const width = Math.max(1, Number(nextLayout.width) || 1);
                    const height = Math.max(1, Number(nextLayout.height) || 1);
                    const next = { width, height };
                    layoutRef.current = next;
                    setLayout(next);
                }}
                style={{
                    flex: 1,
                    minHeight: 80,
                    backgroundColor: config.backgroundColor
                }}
            >
                <Svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={"0 0 " + svgWidth + " " + svgHeight}
                >
                    <Rect x="0" y="0" width={svgWidth} height={svgHeight} fill={config.backgroundColor} />
                    {initialImageUri && SvgImage ? (
                        <SvgImage
                            href={initialImageUri}
                            x="0"
                            y="0"
                            width={svgWidth}
                            height={svgHeight}
                            preserveAspectRatio="xMidYMid meet"
                        />
                    ) : null}
                    {strokes.map(function(stroke, index) {
                        return renderStroke(stroke, "stroke-" + index);
                    })}
                    {renderStroke(currentStroke, "current-stroke")}
                </Svg>
                {empty ? (
                    <View
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 12
                        }}
                    >
                        <Text
                            style={{
                                color: config.penColor,
                                opacity: 0.55,
                                fontSize: 14,
                                textAlign: "center"
                            }}
                            numberOfLines={2}
                        >
                            {config.placeholderText}
                        </Text>
                    </View>
                ) : null}
            </View>
            {config.showToolbar ? (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        padding: 8,
                        backgroundColor: config.toolbarBackgroundColor
                    }}
                >
                    {toolbarChildren}
                </View>
            ) : null}
        </View>
    );
}
