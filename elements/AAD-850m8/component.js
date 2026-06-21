function(props) {
    const libraries = props && props.context && props.context.libraries ? props.context.libraries : {};
    const React = libraries.react;
    const ReactNative = libraries["react-native"] || {};
    const View = ReactNative.View;
    const Text = ReactNative.Text;
    const Pressable = ReactNative.Pressable || ReactNative.TouchableOpacity;
    const SvgModule = libraries["react-native-svg"] || {};
    const SvgXml = SvgModule.SvgXml || SvgModule.SvgFromXml;
    const instance = props && props.instance ? props.instance : {};
    const context = props && props.context ? props.context : {};

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

    function safePublishState(name, value) {
        try {
            if (instance && typeof instance.publishState === "function") {
                instance.publishState(name, value);
            }
        } catch (_error) {
            // Bubble can tear down mobile instances while async callbacks finish.
        }
    }

    function safePublishAutobinding(value) {
        try {
            if (instance && typeof instance.publishAutobinding === "function") {
                instance.publishAutobinding(value);
            }
        } catch (_error) {
            // Autobinding can be absent when the user has not bound the input.
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

    function report(message) {
        safePublishState("last_error", message || "");
        if (message && context && typeof context.reportDebugger === "function") {
            try {
                context.reportDebugger(message);
            } catch (_error) {
                // Debugger reporting is best effort.
            }
        }
    }

    if (!React || !View || !Text) {
        return null;
    }

    if (!React.useState || !React.useRef || !React.useEffect) {
        return (
            <View
                style={{
                    width: props.bubble.width || 320,
                    height: props.bubble.height || 200,
                    backgroundColor: "#fee2e2",
                    borderWidth: 2,
                    borderColor: "#dc2626",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 12
                }}
            >
                <Text style={{ color: "#991b1b", textAlign: "center" }}>
                    React hooks are unavailable in this Bubble mobile runtime.
                </Text>
            </View>
        );
    }

    const bubble = props && props.bubble ? props.bubble : {};
    const width = Math.max(1, readNumber(bubble, "width", 320, 1, 10000));
    const height = Math.max(1, readNumber(bubble, "height", 200, 1, 10000));
    const showToolbar = readBoolean(props, "show_toolbar", true);
    const toolbarHeight = showToolbar ? Math.min(48, Math.max(0, height - 1)) : 0;
    const canvasWidth = width;
    const canvasHeight = Math.max(1, height - toolbarHeight);
    const enabledProp = readBoolean(props, "enabled", true);
    const [enabledOverride, setEnabledOverride] = React.useState(null);
    const enabled = enabledOverride === null ? enabledProp : enabledOverride;
    const [strokes, setStrokes] = React.useState([]);
    const [currentStroke, setCurrentStroke] = React.useState([]);
    const [initialSignature, setInitialSignature] = React.useState(readText(props, "initial_signature", ""));
    const [isUploading, setIsUploading] = React.useState(false);
    const strokesRef = React.useRef([]);
    const currentStrokeRef = React.useRef([]);
    const activeRef = React.useRef(false);
    const lastMoveAtRef = React.useRef(0);
    const commitTimerRef = React.useRef(null);
    const enabledRef = React.useRef(enabled);
    const propsRef = React.useRef(props);
    const contextRef = React.useRef(context);
    const isUploadingRef = React.useRef(isUploading);

    enabledRef.current = enabled;
    propsRef.current = props;
    contextRef.current = context;
    isUploadingRef.current = isUploading;

    function getConfig() {
        const source = propsRef.current || {};
        const minWidth = readNumber(source, "min_width", 0.5, 0.1, 50);
        const maxWidth = Math.max(minWidth, readNumber(source, "max_width", 2.5, minWidth, 50));
        let commitBehavior = readText(source, "commit_behavior", "on_stroke_end").toLowerCase();
        if (commitBehavior !== "manual") commitBehavior = "on_stroke_end";

        return {
            commitBehavior,
            commitDelayMs: Math.round(readNumber(source, "commit_delay_ms", 500, 0, 10000)),
            fileNamePrefix: readText(source, "file_name_prefix", "signature") || "signature",
            penColor: readColor(source, "pen_color", "#111827"),
            minWidth,
            maxWidth,
            backgroundColor: readColor(source, "background_color", "#ffffff"),
            minDistance: readNumber(source, "min_distance", 5, 0, 50),
            throttleMs: Math.round(readNumber(source, "throttle_ms", 16, 0, 1000)),
            placeholderText: readText(source, "placeholder_text", "Sign here"),
            clearButtonLabel: readText(source, "clear_button_label", "Clear"),
            undoButtonLabel: readText(source, "undo_button_label", "Undo"),
            saveButtonLabel: readText(source, "save_button_label", "Save"),
            showClearButton: readBoolean(source, "show_clear_button", true),
            showUndoButton: readBoolean(source, "show_undo_button", true),
            showSaveButton: readBoolean(source, "show_save_button", true),
            toolbarBackgroundColor: readColor(source, "toolbar_background_color", "#f8fafc"),
            buttonBackgroundColor: readColor(source, "button_background_color", "#ffffff"),
            buttonTextColor: readColor(source, "button_text_color", "#111827"),
            buttonBorderColor: readColor(source, "button_border_color", "#cbd5e1")
        };
    }

    const config = getConfig();

    function escapeXml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function sanitizePrefix(value) {
        const sanitized = String(value || "signature").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
        return sanitized || "signature";
    }

    function base64Encode(input) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let output = "";
        let i = 0;
        const text = String(input || "");
        while (i < text.length) {
            const c1 = text.charCodeAt(i++) & 255;
            if (i === text.length) {
                output += chars.charAt(c1 >> 2);
                output += chars.charAt((c1 & 3) << 4);
                output += "==";
                break;
            }
            const c2 = text.charCodeAt(i++) & 255;
            if (i === text.length) {
                output += chars.charAt(c1 >> 2);
                output += chars.charAt(((c1 & 3) << 4) | ((c2 & 240) >> 4));
                output += chars.charAt((c2 & 15) << 2);
                output += "=";
                break;
            }
            const c3 = text.charCodeAt(i++) & 255;
            output += chars.charAt(c1 >> 2);
            output += chars.charAt(((c1 & 3) << 4) | ((c2 & 240) >> 4));
            output += chars.charAt(((c2 & 15) << 2) | ((c3 & 192) >> 6));
            output += chars.charAt(c3 & 63);
        }
        return output;
    }

    function roundCoordinate(value) {
        return Math.round(Number(value || 0) * 10) / 10;
    }

    function formatPoint(point) {
        return roundCoordinate(point.x) + " " + roundCoordinate(point.y);
    }

    function pointsToPath(points) {
        if (!points || !points.length) return "";
        if (points.length === 1) {
            return "M " + formatPoint(points[0]) + " L " + roundCoordinate(points[0].x + 0.1) + " " + roundCoordinate(points[0].y);
        }

        let path = "M " + formatPoint(points[0]);
        for (let i = 1; i < points.length - 1; i += 1) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path += " Q " + formatPoint(points[i]) + " " + roundCoordinate(midX) + " " + roundCoordinate(midY);
        }
        const last = points[points.length - 1];
        path += " L " + formatPoint(last);
        return path;
    }

    function buildSvgXml(includeCurrent) {
        const allStrokes = includeCurrent && currentStrokeRef.current.length
            ? strokesRef.current.concat([currentStrokeRef.current])
            : strokesRef.current;
        const strokeWidth = Math.max(0.1, (config.minWidth + config.maxWidth) / 2);
        let xml = '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvasWidth + '" height="' + canvasHeight + '" viewBox="0 0 ' + canvasWidth + " " + canvasHeight + '">';
        xml += '<rect x="0" y="0" width="' + canvasWidth + '" height="' + canvasHeight + '" fill="' + escapeXml(config.backgroundColor) + '"/>';
        if (initialSignature) {
            xml += '<image href="' + escapeXml(initialSignature) + '" x="0" y="0" width="' + canvasWidth + '" height="' + canvasHeight + '" preserveAspectRatio="xMidYMid meet"/>';
        }
        for (let i = 0; i < allStrokes.length; i += 1) {
            const path = pointsToPath(allStrokes[i]);
            if (path) {
                xml += '<path d="' + path + '" fill="none" stroke="' + escapeXml(config.penColor) + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round"/>';
            }
        }
        xml += "</svg>";
        return xml;
    }

    function hasSignature() {
        return !!initialSignature || strokesRef.current.length > 0 || currentStrokeRef.current.length > 0;
    }

    function setStrokesBoth(nextStrokes) {
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
    }

    function setCurrentStrokeBoth(nextStroke) {
        currentStrokeRef.current = nextStroke;
        setCurrentStroke(nextStroke);
    }

    function clearCommitTimer() {
        if (commitTimerRef.current) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    }

    function makeSvgData() {
        const xml = buildSvgXml(true);
        const base64 = base64Encode(xml);
        return {
            xml,
            base64,
            dataUrl: "data:image/svg+xml;base64," + base64
        };
    }

    function uploadSvg(base64, callback) {
        const uploadContext = contextRef.current || {};
        if (!uploadContext || typeof uploadContext.uploadContent !== "function") {
            callback(new Error("No Bubble file upload utility is available in this mobile runtime."));
            return;
        }

        const fileName = sanitizePrefix(config.fileNamePrefix) + "-" + Date.now() + ".svg";
        try {
            uploadContext.uploadContent(fileName, base64, function(err, url) {
                callback(err, url || "");
            });
        } catch (error) {
            callback(error);
        }
    }

    function publishSnapshot(triggerChanged) {
        const empty = !hasSignature();
        const svgData = empty ? { dataUrl: "" } : makeSvgData();
        safePublishState("signature_data_url", svgData.dataUrl);
        safePublishState("is_empty", empty);
        safePublishState("stroke_count", strokesRef.current.length);
        safePublishState("last_error", "");
        if (triggerChanged) safeTrigger("signature_changed");
    }

    function saveSignature() {
        clearCommitTimer();
        if (!hasSignature()) {
            report("Signature is empty.");
            safeTrigger("signature_error");
            return;
        }
        if (isUploadingRef.current) return;

        const svgData = makeSvgData();
        setIsUploading(true);
        isUploadingRef.current = true;
        safePublishState("is_uploading", true);
        safePublishState("signature_data_url", svgData.dataUrl);

        uploadSvg(svgData.base64, function(err, url) {
            setIsUploading(false);
            isUploadingRef.current = false;
            safePublishState("is_uploading", false);
            if (err || !url) {
                report(err && err.message ? err.message : "Unable to upload signature image.");
                safeTrigger("signature_error");
                return;
            }
            safePublishState("value", url);
            safePublishAutobinding(url);
            safePublishState("last_error", "");
            safeTrigger("signature_saved");
        });
    }

    function scheduleCommit() {
        clearCommitTimer();
        if (config.commitBehavior !== "on_stroke_end" || !hasSignature()) return;
        commitTimerRef.current = setTimeout(saveSignature, config.commitDelayMs);
    }

    function clearSignature() {
        clearCommitTimer();
        setInitialSignature("");
        setStrokesBoth([]);
        setCurrentStrokeBoth([]);
        safePublishState("value", null);
        safePublishAutobinding(null);
        safePublishState("signature_data_url", "");
        safePublishState("is_empty", true);
        safePublishState("is_drawing", false);
        safePublishState("is_uploading", false);
        safePublishState("stroke_count", 0);
        safePublishState("last_error", "");
        safeTrigger("signature_cleared");
    }

    function undoLastStroke() {
        if (!strokesRef.current.length) return;
        const nextStrokes = strokesRef.current.slice(0, -1);
        setStrokesBoth(nextStrokes);
        setTimeout(function() {
            publishSnapshot(true);
            scheduleCommit();
        }, 20);
    }

    function setEnabled(nextEnabled) {
        setEnabledOverride(readBoolean({ enabled: nextEnabled }, "enabled", true));
    }

    function pointFromEvent(event) {
        const native = event && event.nativeEvent ? event.nativeEvent : {};
        if (!Number.isFinite(native.locationX) || !Number.isFinite(native.locationY)) return null;
        const x = native.locationX;
        const y = native.locationY;
        return {
            x: roundCoordinate(Math.max(0, Math.min(canvasWidth, x))),
            y: roundCoordinate(Math.max(0, Math.min(canvasHeight, y))),
            time: Date.now()
        };
    }

    function distanceFromLastPoint(point) {
        const stroke = currentStrokeRef.current;
        if (!stroke.length) return Infinity;
        const last = stroke[stroke.length - 1];
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function shouldAddPoint(point, force) {
        const distance = distanceFromLastPoint(point);
        if (distance === Infinity) return true;
        return distance >= (force ? 0.5 : config.minDistance);
    }

    function appendPointToCurrentStroke(point, force) {
        if (!point || !shouldAddPoint(point, force)) return false;
        const nextStroke = currentStrokeRef.current.concat([point]);
        setCurrentStrokeBoth(nextStroke);
        return true;
    }

    function beginStroke(event) {
        if (!enabledRef.current || isUploadingRef.current) return;
        if (activeRef.current) return;
        activeRef.current = true;
        const point = pointFromEvent(event);
        if (!point) {
            activeRef.current = false;
            return;
        }
        setCurrentStrokeBoth([point]);
        lastMoveAtRef.current = Date.now();
        safePublishState("is_drawing", true);
        safePublishState("is_empty", false);
        safePublishState("last_error", "");
        safeTrigger("signature_started");
    }

    function beginStrokeIfNeeded(event) {
        if (activeRef.current) return;
        beginStroke(event);
    }

    function moveStroke(event) {
        if (!enabledRef.current || !activeRef.current || !currentStrokeRef.current.length) return;
        const now = Date.now();
        if (config.throttleMs && now - lastMoveAtRef.current < config.throttleMs) return;
        const point = pointFromEvent(event);
        if (appendPointToCurrentStroke(point, false)) {
            lastMoveAtRef.current = now;
        }
    }

    function endStroke(event) {
        if (!activeRef.current && !currentStrokeRef.current.length) {
            safePublishState("is_drawing", false);
            return;
        }

        if (event && currentStrokeRef.current.length) {
            appendPointToCurrentStroke(pointFromEvent(event), true);
        }

        activeRef.current = false;
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
        setTimeout(function() {
            publishSnapshot(true);
            scheduleCommit();
        }, 20);
    }

    React.useEffect(function() {
        const source = readText(props, "initial_signature", "");
        setInitialSignature(source);
        safePublishState("value", source && /^https?:\/\//i.test(source) ? source : null);
        safePublishState("signature_data_url", /^data:image\//i.test(source) ? source : "");
        safePublishState("is_empty", !source && strokesRef.current.length === 0);
    }, [readText(props, "initial_signature", "")]);

    React.useEffect(function() {
        safePublishState("is_empty", !hasSignature());
        safePublishState("is_drawing", false);
        safePublishState("is_uploading", false);
        safePublishState("stroke_count", strokesRef.current.length);
        safePublishState("last_error", "");
        return clearCommitTimer;
    }, []);

    React.useEffect(function() {
        setEnabledOverride(null);
    }, [enabledProp]);

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

    if (!SvgXml) {
        const svgKeys = SvgModule ? Object.keys(SvgModule).slice(0, 20).join(",") : "missing";
        report("SvgXml is unavailable. react-native-svg keys: " + svgKeys);
        return (
            <View
                style={{
                    width,
                    height,
                    backgroundColor: "#fee2e2",
                    borderWidth: 2,
                    borderColor: "#dc2626",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 12
                }}
            >
                <Text style={{ color: "#991b1b", textAlign: "center" }}>
                    Signature renderer unavailable
                </Text>
            </View>
        );
    }

    const empty = !initialSignature && !strokes.length && !currentStroke.length;
    const disabled = !enabled || isUploading;
    const borderWidth = Math.max(0, readNumber(bubble, "border_width", 1, 0, 20));
    const borderColor = readColor(bubble, "border_color", "#cbd5e1");
    const borderRadius = Math.max(0, readNumber(bubble, "border_roundness", 6, 0, 100));
    const xml = buildSvgXml(true);

    function renderButton(key, label, visible, action) {
        if (!visible || !Pressable) return null;
        return (
            <Pressable
                key={key}
                disabled={disabled}
                onPress={disabled ? undefined : action}
                style={{
                    minHeight: 32,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    marginLeft: 8,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderColor: config.buttonBorderColor,
                    backgroundColor: config.buttonBackgroundColor,
                    opacity: disabled ? 0.55 : 1,
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Text style={{ color: config.buttonTextColor, fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                    {label}
                </Text>
            </Pressable>
        );
    }

    return (
        <View
            style={{
                width,
                height,
                backgroundColor: config.backgroundColor,
                borderWidth,
                borderColor,
                borderRadius,
                overflow: "hidden",
                opacity: enabled ? 1 : 0.72
            }}
        >
            <View
                style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    backgroundColor: config.backgroundColor
                }}
                onStartShouldSetResponder={() => enabledRef.current && !isUploadingRef.current}
                onStartShouldSetResponderCapture={() => enabledRef.current && !isUploadingRef.current}
                onMoveShouldSetResponder={() => enabledRef.current && !isUploadingRef.current}
                onMoveShouldSetResponderCapture={() => enabledRef.current && !isUploadingRef.current}
                onResponderGrant={(event) => beginStroke(event)}
                onResponderMove={(event) => moveStroke(event)}
                onResponderRelease={(event) => endStroke(event)}
                onResponderTerminate={(event) => endStroke(event)}
                onTouchStart={(event) => beginStrokeIfNeeded(event)}
                onTouchMove={(event) => moveStroke(event)}
                onTouchEnd={(event) => endStroke(event)}
                onTouchCancel={(event) => endStroke(event)}
            >
                <SvgXml xml={xml} width={canvasWidth} height={canvasHeight} />
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
                        <Text style={{ color: config.penColor, opacity: 0.55, textAlign: "center" }} numberOfLines={2}>
                            {config.placeholderText}
                        </Text>
                    </View>
                ) : null}
            </View>
            {showToolbar ? (
                <View
                    style={{
                        width,
                        height: toolbarHeight,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        padding: 8,
                        backgroundColor: config.toolbarBackgroundColor
                    }}
                >
                    {renderButton("undo", config.undoButtonLabel, config.showUndoButton, undoLastStroke)}
                    {renderButton("clear", config.clearButtonLabel, config.showClearButton, clearSignature)}
                    {renderButton("save", config.saveButtonLabel, config.showSaveButton, saveSignature)}
                </View>
            ) : null}
        </View>
    );
}
