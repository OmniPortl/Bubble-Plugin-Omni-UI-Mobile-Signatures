function(props) {
    const libraries = props && props.context && props.context.libraries ? props.context.libraries : {};
    const React = libraries.react;
    const ReactNative = libraries["react-native"] || {};
    const View = ReactNative.View;
    const Text = ReactNative.Text;
    const Pressable = ReactNative.Pressable || ReactNative.TouchableOpacity;
    const WebViewModule = libraries["react-native-webview"] || {};
    const WebView = WebViewModule.WebView || WebViewModule.default || WebViewModule;
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
    const configJson = JSON.stringify(config);
    const webViewRef = React.useRef(null);
    const contextRef = React.useRef(props && props.context ? props.context : {});
    const configRef = React.useRef(config);
    const commitTimerRef = React.useRef(null);
    const [isUploading, setIsUploading] = React.useState(false);

    contextRef.current = props && props.context ? props.context : {};
    configRef.current = config;

    function safePublishState(name, value) {
        try {
            if (instance && typeof instance.publishState === "function") {
                instance.publishState(name, value);
            }
        } catch (_error) {
            // Mobile plugin lifecycle can briefly outlive the Bubble instance.
        }
    }

    function safePublishAutobinding(value) {
        try {
            if (instance && typeof instance.publishAutobinding === "function") {
                instance.publishAutobinding(value);
            }
        } catch (_error) {
            // Autobinding may be unavailable in some native preview runtimes.
        }
    }

    function safeTrigger(name) {
        try {
            if (instance && typeof instance.triggerEvent === "function") {
                instance.triggerEvent(name);
            }
        } catch (_error) {
            // Ignore teardown races.
        }
    }

    function setError(message) {
        safePublishState("last_error", message || "");
        if (message) safeTrigger("signature_error");
    }

    function postCommand(type, payload) {
        const target = webViewRef.current;
        if (!target || typeof target.postMessage !== "function") return;
        target.postMessage(JSON.stringify({
            type,
            payload: payload || {}
        }));
    }

    function publishPayload(payload) {
        const data = payload || {};
        safePublishState("signature_data_url", data.dataUrl || "");
        safePublishState("is_empty", !!data.isEmpty);
        safePublishState("stroke_count", Number(data.strokeCount) || 0);
    }

    function clearCommitTimer() {
        if (commitTimerRef.current) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    }

    function scheduleCommit(payload) {
        clearCommitTimer();
        if (configRef.current.commitBehavior !== "on_stroke_end") return;
        if (payload && payload.isEmpty) return;
        commitTimerRef.current = setTimeout(function() {
            postCommand("save");
        }, configRef.current.commitDelayMs);
    }

    function sanitizePrefix(value) {
        const sanitized = String(value || "signature").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
        return sanitized || "signature";
    }

    function fileNameForConfig() {
        const extension = configRef.current.outputFormat === "jpeg" ? "jpg" : "png";
        return sanitizePrefix(configRef.current.fileNamePrefix) + "-" + Date.now() + "." + extension;
    }

    function dataUrlToBase64(dataUrl) {
        const text = String(dataUrl || "");
        const commaIndex = text.indexOf(",");
        return commaIndex >= 0 ? text.slice(commaIndex + 1) : text;
    }

    function uploadWithContext(dataUrl, fileName) {
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
                const result = uploadContext.uploadContent(fileName, dataUrlToBase64(dataUrl), done);
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

    function handleSavePayload(payload) {
        const data = payload || {};
        if (data.isEmpty || !data.dataUrl) {
            setError("Signature is empty.");
            return;
        }

        safePublishState("signature_data_url", data.dataUrl);
        setIsUploading(true);
        safePublishState("is_uploading", true);

        uploadWithContext(data.dataUrl, fileNameForConfig()).then(function(url) {
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
    }

    function handleMessage(event) {
        let message = null;
        try {
            message = JSON.parse(event && event.nativeEvent ? event.nativeEvent.data : "{}");
        } catch (_error) {
            return;
        }

        const payload = message.payload || {};

        if (message.type === "ready") {
            publishPayload(payload);
            postCommand("updateConfig", configRef.current);
            return;
        }

        if (message.type === "signature_started") {
            safePublishState("is_drawing", true);
            safeTrigger("signature_started");
            return;
        }

        if (message.type === "signature_changed") {
            publishPayload(payload);
            safeTrigger("signature_changed");
            scheduleCommit(payload);
            return;
        }

        if (message.type === "signature_ended") {
            safePublishState("is_drawing", false);
            publishPayload(payload);
            safeTrigger("signature_changed");
            safeTrigger("signature_ended");
            scheduleCommit(payload);
            return;
        }

        if (message.type === "signature_state") {
            publishPayload(payload);
            return;
        }

        if (message.type === "signature_cleared") {
            clearCommitTimer();
            safePublishState("value", null);
            safePublishAutobinding(null);
            safePublishState("signature_data_url", "");
            safePublishState("is_empty", true);
            safePublishState("is_drawing", false);
            safePublishState("stroke_count", 0);
            safePublishState("last_error", "");
            safeTrigger("signature_cleared");
            return;
        }

        if (message.type === "save_requested") {
            publishPayload(payload);
            handleSavePayload(payload);
            return;
        }

        if (message.type === "signature_error") {
            setError(payload.message || "Signature capture failed.");
        }
    }

    const html = React.useMemo(function() {
        return buildHtml(config);
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
        postCommand("updateConfig", config);
    }, [configJson]);

    React.useEffect(function() {
        setEnabledOverride(null);
    }, [baseConfig.enabled]);

    React.useEffect(function() {
        const source = config.initialSignature || "";
        if (source && !/^data:image\//i.test(source) && /^https?:\/\//i.test(source)) {
            safePublishState("value", source);
            safePublishAutobinding(source);
        }
    }, [config.initialSignature]);

    React.useEffect(function() {
        if (!View || !Text || !WebView) {
            setError("react-native-webview is unavailable in this Bubble mobile runtime.");
        }
    }, [View, Text, WebView]);

    if (instance && instance.data) {
        instance.data.omniSignatureMobileRuntime = {
            helpers: {
                saveSignature: function() {
                    postCommand("save");
                },
                clearSignature: function() {
                    postCommand("clear");
                },
                undoLastStroke: function() {
                    postCommand("undo");
                },
                setEnabled: function(enabled) {
                    const nextEnabled = readBoolean({ enabled }, "enabled", true);
                    setEnabledOverride(nextEnabled);
                    postCommand("setEnabled", { enabled: nextEnabled });
                }
            }
        };
    }

    if (!View || !Text || !WebView) {
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
                    Signature WebView unavailable
                </Text>
            </View>
        ) : null;
    }

    const disabled = !config.enabled || isUploading;
    const ButtonComponent = Pressable || Text;

    function renderButton(key, label, visible, onPress) {
        if (!visible) return null;
        const buttonStyle = {
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
        };

        return (
            <ButtonComponent
                key={key}
                disabled={disabled}
                onPress={disabled ? undefined : onPress}
                style={buttonStyle}
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
        renderButton("undo", config.undoButtonLabel, config.showUndoButton, function() {
            postCommand("undo");
        }),
        renderButton("clear", config.clearButtonLabel, config.showClearButton, function() {
            postCommand("clear");
        }),
        renderButton("save", config.saveButtonLabel, config.showSaveButton, function() {
            postCommand("save");
        })
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
                key="webview-wrap"
                style={{
                    flex: 1,
                    minHeight: 80,
                    backgroundColor: config.backgroundColor
                }}
            >
                <WebView
                    ref={webViewRef}
                    source={{ html }}
                    originWhitelist={["*"]}
                    javaScriptEnabled={true}
                    scrollEnabled={false}
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    automaticallyAdjustContentInsets={false}
                    onMessage={handleMessage}
                    onLoadEnd={function() {
                        postCommand("updateConfig", configRef.current);
                    }}
                    style={{
                        flex: 1,
                        backgroundColor: config.backgroundColor
                    }}
                />
            </View>
            {config.showToolbar ? (
                <View
                    key="toolbar"
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

    function buildHtml(initialConfig) {
        const configScript = JSON.stringify(initialConfig || {}).replace(/</g, "\\u003c");
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;overscroll-behavior:none;}#root{position:relative;width:100vw;height:100vh;min-width:1px;min-height:1px;overflow:hidden;}#pad{display:block;width:100%;height:100%;touch-action:none;}#placeholder{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font:14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;opacity:.55;pointer-events:none;}</style></head><body><div id=\"root\"><canvas id=\"pad\"></canvas><div id=\"placeholder\"></div></div><script>(" + webSignatureRuntime.toString() + ")(" + configScript + ");</script></body></html>";
    }

    function webSignatureRuntime(initialConfig) {
        var config = initialConfig || {};
        var root = document.getElementById("root");
        var canvas = document.getElementById("pad");
        var placeholder = document.getElementById("placeholder");
        var ctx = canvas.getContext("2d");
        var ratio = Math.max(window.devicePixelRatio || 1, 1);
        var displayWidth = 1;
        var displayHeight = 1;
        var strokes = [];
        var currentStroke = null;
        var baseImage = null;
        var drawing = false;
        var enabled = config.enabled !== false;
        var lastMoveAt = 0;
        var initialSignatureKey = null;
        var lastCanvasWidth = 0;
        var lastCanvasHeight = 0;

        function post(type, payload) {
            try {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: type,
                    payload: payload || {}
                }));
            } catch (_error) {
                // Native bridge is unavailable only during WebView teardown.
            }
        }

        function isEmpty() {
            return !baseImage && strokes.length === 0 && !currentStroke;
        }

        function strokeCount() {
            return strokes.length;
        }

        function exportDataUrl() {
            if (isEmpty()) return "";
            var mime = config.outputFormat === "jpeg" ? "image/jpeg" : "image/png";
            if (config.outputFormat === "jpeg") {
                return canvas.toDataURL(mime, config.jpegQuality || 0.92);
            }
            return canvas.toDataURL(mime);
        }

        function payload() {
            var dataUrl = "";
            try {
                dataUrl = exportDataUrl();
            } catch (error) {
                post("signature_error", { message: error && error.message ? error.message : "Unable to export signature image." });
            }
            return {
                dataUrl: dataUrl,
                isEmpty: isEmpty(),
                strokeCount: strokeCount()
            };
        }

        function fillBackground() {
            ctx.fillStyle = config.backgroundColor || "#ffffff";
            ctx.fillRect(0, 0, displayWidth, displayHeight);
        }

        function drawBaseImage() {
            if (!baseImage) return;
            var scale = Math.min(displayWidth / baseImage.width, displayHeight / baseImage.height);
            var width = baseImage.width * scale;
            var height = baseImage.height * scale;
            var x = (displayWidth - width) / 2;
            var y = (displayHeight - height) / 2;
            ctx.drawImage(baseImage, x, y, width, height);
        }

        function drawStroke(points) {
            if (!points || !points.length) return;
            var lineWidth = Math.max(0.1, ((Number(config.minWidth) || 0.5) + (Number(config.maxWidth) || 2.5)) / 2);
            ctx.strokeStyle = config.penColor || "#111827";
            ctx.fillStyle = config.penColor || "#111827";
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (points.length === 1) {
                ctx.beginPath();
                ctx.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < points.length - 1; i += 1) {
                var midX = (points[i].x + points[i + 1].x) / 2;
                var midY = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
            }
            var last = points[points.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        }

        function render() {
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            fillBackground();
            drawBaseImage();
            strokes.forEach(drawStroke);
            if (currentStroke) drawStroke(currentStroke);
            placeholder.textContent = config.placeholderText || "Sign here";
            placeholder.style.color = config.penColor || "#111827";
            placeholder.style.display = isEmpty() ? "block" : "none";
            root.style.backgroundColor = config.backgroundColor || "#ffffff";
        }

        function resize() {
            var rect = root.getBoundingClientRect();
            var nextWidth = Math.max(1, rect.width || window.innerWidth || document.documentElement.clientWidth || 1);
            var nextHeight = Math.max(1, rect.height || window.innerHeight || document.documentElement.clientHeight || 1);
            ratio = Math.max(window.devicePixelRatio || 1, 1);
            displayWidth = nextWidth;
            displayHeight = nextHeight;
            var canvasWidth = Math.floor(displayWidth * ratio);
            var canvasHeight = Math.floor(displayHeight * ratio);
            if (canvasWidth !== lastCanvasWidth || canvasHeight !== lastCanvasHeight) {
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                lastCanvasWidth = canvasWidth;
                lastCanvasHeight = canvasHeight;
            }
            render();
        }

        function scheduleResize(delay) {
            window.setTimeout(function() {
                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(resize);
                } else {
                    resize();
                }
            }, delay || 0);
        }

        function getEventPoint(event) {
            var source = event.touches && event.touches[0] ? event.touches[0] : event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event;
            var rect = canvas.getBoundingClientRect();
            var clientX = source.clientX !== undefined ? source.clientX : source.pageX;
            var clientY = source.clientY !== undefined ? source.clientY : source.pageY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top,
                time: Date.now()
            };
        }

        function shouldAddPoint(point) {
            if (!currentStroke || !currentStroke.length) return true;
            var last = currentStroke[currentStroke.length - 1];
            var minDistance = Math.max(0, Number(config.minDistance) || 0);
            var dx = point.x - last.x;
            var dy = point.y - last.y;
            return dx * dx + dy * dy >= minDistance * minDistance;
        }

        function start(event) {
            if (!enabled) return;
            event.preventDefault();
            if (displayWidth <= 1 || displayHeight <= 1) resize();
            if (event.pointerId !== undefined && canvas.setPointerCapture) {
                try {
                    canvas.setPointerCapture(event.pointerId);
                } catch (_error) {
                    // Some WebViews expose PointerEvent without capture support.
                }
            }
            drawing = true;
            currentStroke = [getEventPoint(event)];
            lastMoveAt = Date.now();
            post("signature_started", payload());
            render();
        }

        function move(event) {
            if (!drawing || !currentStroke) return;
            event.preventDefault();
            var now = Date.now();
            var throttle = Math.max(0, Number(config.throttleMs) || 0);
            if (throttle && now - lastMoveAt < throttle) return;
            lastMoveAt = now;

            var point = getEventPoint(event);
            if (!shouldAddPoint(point)) return;
            currentStroke.push(point);
            render();
        }

        function end(event) {
            if (!drawing || !currentStroke) return;
            event.preventDefault();
            if (event.pointerId !== undefined && canvas.releasePointerCapture) {
                try {
                    canvas.releasePointerCapture(event.pointerId);
                } catch (_error) {
                    // Ignore capture release races.
                }
            }
            drawing = false;
            if (currentStroke.length) strokes.push(currentStroke);
            currentStroke = null;
            render();
            post("signature_ended", payload());
        }

        function clear() {
            strokes = [];
            currentStroke = null;
            baseImage = null;
            drawing = false;
            render();
            post("signature_cleared", payload());
        }

        function undo() {
            if (strokes.length) {
                strokes.pop();
            } else if (baseImage) {
                baseImage = null;
            }
            currentStroke = null;
            render();
            post("signature_changed", payload());
        }

        function save() {
            post("save_requested", payload());
        }

        function loadInitialSignature(source) {
            if (source === initialSignatureKey) return;
            initialSignatureKey = source || "";

            if (!source) {
                render();
                post("ready", payload());
                return;
            }

            var image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = function() {
                baseImage = image;
                strokes = [];
                currentStroke = null;
                render();
                post("signature_state", payload());
            };
            image.onerror = function() {
                post("signature_error", { message: "Unable to load the initial signature." });
            };
            image.src = source;
        }

        function applyConfig(nextConfig) {
            config = nextConfig || config || {};
            enabled = config.enabled !== false;
            render();
            loadInitialSignature(config.initialSignature || "");
        }

        function handleNativeMessage(event) {
            var message = null;
            try {
                message = JSON.parse(event.data || "{}");
            } catch (_error) {
                return;
            }
            var command = message.type;
            var commandPayload = message.payload || {};

            if (command === "updateConfig") {
                applyConfig(commandPayload);
            } else if (command === "save") {
                save();
            } else if (command === "clear") {
                clear();
            } else if (command === "undo") {
                undo();
            } else if (command === "setEnabled") {
                enabled = commandPayload.enabled !== false;
                config.enabled = enabled;
            }
        }

        if (window.PointerEvent) {
            canvas.addEventListener("pointerdown", start, { passive: false });
            window.addEventListener("pointermove", move, { passive: false });
            window.addEventListener("pointerup", end, { passive: false });
            window.addEventListener("pointercancel", end, { passive: false });
        } else {
            canvas.addEventListener("touchstart", start, { passive: false });
            window.addEventListener("touchmove", move, { passive: false });
            window.addEventListener("touchend", end, { passive: false });
            window.addEventListener("touchcancel", end, { passive: false });
            canvas.addEventListener("mousedown", start);
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", end);
        }
        window.addEventListener("resize", resize);
        window.addEventListener("message", handleNativeMessage);
        document.addEventListener("message", handleNativeMessage);

        if (window.ResizeObserver) {
            var observer = new ResizeObserver(function() {
                resize();
            });
            observer.observe(root);
        }

        resize();
        scheduleResize(0);
        scheduleResize(50);
        scheduleResize(150);
        scheduleResize(350);
        scheduleResize(750);
        applyConfig(config);
        post("ready", payload());
    }
}
