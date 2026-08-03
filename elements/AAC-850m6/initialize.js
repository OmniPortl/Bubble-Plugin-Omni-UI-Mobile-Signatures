function(instance, context) {
    instance.data = instance.data || {};

    instance.data.omniSignatureBootstrap = function() {
        if (instance.data.omniSignatureRuntime) {
            return instance.data.omniSignatureRuntime;
        }

        var SIGNATURE_PAD_URL = "https://cdn.jsdelivr.net/npm/signature_pad@5.1.3/dist/signature_pad.umd.min.js";
        var SIGNATURE_PAD_SCRIPT_ID = "omni-ui-signature-pad-5-1-3";

        var runtime = {
            pad: null,
            root: null,
            toolbar: null,
            stage: null,
            canvas: null,
            placeholder: null,
            buttons: {},
            config: {},
            latestContext: context || null,
            latestProperties: {},
            initialSignatureKey: null,
            isDrawing: false,
            isUploading: false,
            pendingCommitTimer: null,
            resizeObserver: null,
            resizeTimer: null,
            helpers: {}
        };

        function hostElement() {
            if (instance.canvas && instance.canvas[0]) return instance.canvas[0];
            if (instance.canvas && typeof instance.canvas.get === "function") return instance.canvas.get(0);
            return null;
        }

        function safePublishState(name, value) {
            try {
                if (instance && typeof instance.publishState === "function") {
                    instance.publishState(name, value);
                }
            } catch (_error) {
                // Bubble can reject state writes during teardown; ignore those lifecycle races.
            }
        }

        function safePublishAutobinding(value) {
            try {
                if (instance && typeof instance.publishAutobinding === "function") {
                    instance.publishAutobinding(value);
                }
            } catch (_error) {
                // Autobinding is only available in supported input runtimes.
            }
        }

        function safeTrigger(name) {
            try {
                if (instance && typeof instance.triggerEvent === "function") {
                    instance.triggerEvent(name);
                }
            } catch (_error) {
                // Event dispatch can race with Bubble page transitions.
            }
        }

        function setError(message) {
            safePublishState("last_error", message || "");
            if (message) safeTrigger("signature_error");
        }

        function readProperty(properties, name, fallback) {
            var source = properties || {};
            var value = source[name];
            if (typeof value === "function") {
                try {
                    value = value();
                } catch (_error) {
                    value = fallback;
                }
            }
            return value === undefined || value === null ? fallback : value;
        }

        function readText(properties, name, fallback) {
            var value = readProperty(properties, name, fallback);
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

        function readBoolean(properties, name, fallback) {
            var value = readProperty(properties, name, fallback);
            if (value === undefined || value === null || value === "") return !!fallback;
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value !== 0;
            value = String(value).toLowerCase().trim();
            if (value === "false" || value === "no" || value === "0") return false;
            if (value === "true" || value === "yes" || value === "1") return true;
            return !!fallback;
        }

        function readNumber(properties, name, fallback, min, max) {
            var value = Number(readProperty(properties, name, fallback));
            if (!isFinite(value)) value = Number(fallback);
            if (isFinite(min)) value = Math.max(min, value);
            if (isFinite(max)) value = Math.min(max, value);
            return value;
        }

        function readColor(properties, name, fallback) {
            var value = readProperty(properties, name, fallback);
            if (!value) return fallback;
            return String(value);
        }

        function buildConfig(properties) {
            var outputFormat = readText(properties, "output_format", "png").toLowerCase();
            if (outputFormat !== "jpeg") outputFormat = "png";

            var commitBehavior = readText(properties, "commit_behavior", "on_stroke_end").toLowerCase();
            if (commitBehavior !== "manual") commitBehavior = "on_stroke_end";

            var minWidth = readNumber(properties, "min_width", 0.5, 0.1, 50);
            var maxWidth = readNumber(properties, "max_width", 2.5, minWidth, 50);
            if (maxWidth < minWidth) maxWidth = minWidth;

            return {
                initialSignature: readText(properties, "initial_signature", ""),
                enabled: readBoolean(properties, "enabled", true),
                commitBehavior: commitBehavior,
                commitDelayMs: Math.round(readNumber(properties, "commit_delay_ms", 500, 0, 10000)),
                fileNamePrefix: readText(properties, "file_name_prefix", "signature") || "signature",
                outputFormat: outputFormat,
                jpegQuality: readNumber(properties, "jpeg_quality", 0.92, 0, 1),
                penColor: readColor(properties, "pen_color", "#111827"),
                minWidth: minWidth,
                maxWidth: maxWidth,
                backgroundColor: readColor(properties, "background_color", "#ffffff"),
                minDistance: readNumber(properties, "min_distance", 5, 0, 50),
                throttleMs: Math.round(readNumber(properties, "throttle_ms", 16, 0, 1000)),
                placeholderText: readText(properties, "placeholder_text", "Sign here"),
                showToolbar: readBoolean(properties, "show_toolbar", true),
                showClearButton: readBoolean(properties, "show_clear_button", true),
                showUndoButton: readBoolean(properties, "show_undo_button", true),
                showSaveButton: readBoolean(properties, "show_save_button", true),
                clearButtonLabel: readText(properties, "clear_button_label", "Clear"),
                undoButtonLabel: readText(properties, "undo_button_label", "Undo"),
                saveButtonLabel: readText(properties, "save_button_label", "Save"),
                toolbarBackgroundColor: readColor(properties, "toolbar_background_color", "#f8fafc"),
                buttonBackgroundColor: readColor(properties, "button_background_color", "#ffffff"),
                buttonTextColor: readColor(properties, "button_text_color", "#111827"),
                buttonBorderColor: readColor(properties, "button_border_color", "#cbd5e1")
            };
        }

        function loadSignaturePad() {
            if (typeof window !== "undefined" && window.SignaturePad) {
                return Promise.resolve(window.SignaturePad);
            }
            if (instance.data.omniSignaturePadLoader) {
                return instance.data.omniSignaturePadLoader;
            }

            instance.data.omniSignaturePadLoader = new Promise(function(resolve, reject) {
                if (typeof document === "undefined") {
                    reject(new Error("The browser document is not available."));
                    return;
                }

                var existing = document.getElementById(SIGNATURE_PAD_SCRIPT_ID);
                if (existing) {
                    existing.addEventListener("load", function() {
                        resolve(window.SignaturePad);
                    });
                    existing.addEventListener("error", function() {
                        reject(new Error("Unable to load signature_pad."));
                    });
                    return;
                }

                var script = document.createElement("script");
                script.id = SIGNATURE_PAD_SCRIPT_ID;
                script.src = SIGNATURE_PAD_URL;
                script.async = true;
                script.onload = function() {
                    if (window.SignaturePad) {
                        resolve(window.SignaturePad);
                    } else {
                        reject(new Error("signature_pad loaded without exposing SignaturePad."));
                    }
                };
                script.onerror = function() {
                    reject(new Error("Unable to load signature_pad@5.1.3."));
                };
                document.head.appendChild(script);
            });

            return instance.data.omniSignaturePadLoader;
        }

        function button(label, action) {
            var el = document.createElement("button");
            el.type = "button";
            el.textContent = label;
            el.addEventListener("click", function(event) {
                event.preventDefault();
                action();
            });
            return el;
        }

        function createDom() {
            if (runtime.root) return;

            var host = hostElement();
            if (!host || typeof document === "undefined") return;

            if (instance.canvas && typeof instance.canvas.empty === "function") {
                instance.canvas.empty();
            } else {
                host.innerHTML = "";
            }

            var root = document.createElement("div");
            var toolbar = document.createElement("div");
            var stage = document.createElement("div");
            var canvas = document.createElement("canvas");
            var placeholder = document.createElement("div");

            root.className = "omni-signature-root";
            toolbar.className = "omni-signature-toolbar";
            stage.className = "omni-signature-stage";
            canvas.className = "omni-signature-canvas";
            placeholder.className = "omni-signature-placeholder";

            runtime.buttons.undo = button("Undo", function() {
                runtime.helpers.undoLastStroke();
            });
            runtime.buttons.clear = button("Clear", function() {
                runtime.helpers.clearSignature();
            });
            runtime.buttons.save = button("Save", function() {
                runtime.helpers.saveSignature(runtime.latestContext);
            });

            toolbar.appendChild(runtime.buttons.undo);
            toolbar.appendChild(runtime.buttons.clear);
            toolbar.appendChild(runtime.buttons.save);
            stage.appendChild(canvas);
            stage.appendChild(placeholder);
            root.appendChild(stage);
            root.appendChild(toolbar);
            host.appendChild(root);

            runtime.root = root;
            runtime.toolbar = toolbar;
            runtime.stage = stage;
            runtime.canvas = canvas;
            runtime.placeholder = placeholder;

            root.style.boxSizing = "border-box";
            root.style.display = "flex";
            root.style.flexDirection = "column";
            root.style.width = "100%";
            root.style.height = "100%";
            root.style.minHeight = "120px";
            root.style.overflow = "hidden";

            stage.style.position = "relative";
            stage.style.flex = "1 1 auto";
            stage.style.minHeight = "80px";
            stage.style.overflow = "hidden";

            canvas.style.display = "block";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.touchAction = "none";
            canvas.style.cursor = "crosshair";

            placeholder.style.position = "absolute";
            placeholder.style.left = "0";
            placeholder.style.right = "0";
            placeholder.style.top = "50%";
            placeholder.style.transform = "translateY(-50%)";
            placeholder.style.textAlign = "center";
            placeholder.style.pointerEvents = "none";
            placeholder.style.fontSize = "14px";
            placeholder.style.opacity = "0.55";

            toolbar.style.flex = "0 0 auto";
            toolbar.style.display = "flex";
            toolbar.style.alignItems = "center";
            toolbar.style.justifyContent = "flex-end";
            toolbar.style.gap = "8px";
            toolbar.style.padding = "8px";
            toolbar.style.boxSizing = "border-box";

            Object.keys(runtime.buttons).forEach(function(key) {
                var item = runtime.buttons[key];
                item.style.boxSizing = "border-box";
                item.style.minHeight = "32px";
                item.style.padding = "6px 12px";
                item.style.borderRadius = "6px";
                item.style.borderStyle = "solid";
                item.style.borderWidth = "1px";
                item.style.font = "inherit";
                item.style.cursor = "pointer";
            });

            if (typeof ResizeObserver !== "undefined") {
                runtime.resizeObserver = new ResizeObserver(function() {
                    scheduleResize();
                });
                runtime.resizeObserver.observe(stage);
            } else if (typeof window !== "undefined") {
                window.addEventListener("resize", scheduleResize);
            }
        }

        function applyDomConfig() {
            var config = runtime.config;
            if (!runtime.root) return;

            runtime.root.style.backgroundColor = config.backgroundColor;
            runtime.stage.style.backgroundColor = config.backgroundColor;
            runtime.toolbar.style.backgroundColor = config.toolbarBackgroundColor;
            runtime.toolbar.style.display = config.showToolbar ? "flex" : "none";
            runtime.placeholder.textContent = config.placeholderText;

            runtime.buttons.undo.textContent = config.undoButtonLabel;
            runtime.buttons.clear.textContent = config.clearButtonLabel;
            runtime.buttons.save.textContent = config.saveButtonLabel;
            runtime.buttons.undo.style.display = config.showUndoButton ? "" : "none";
            runtime.buttons.clear.style.display = config.showClearButton ? "" : "none";
            runtime.buttons.save.style.display = config.showSaveButton ? "" : "none";

            Object.keys(runtime.buttons).forEach(function(key) {
                var item = runtime.buttons[key];
                item.style.backgroundColor = config.buttonBackgroundColor;
                item.style.borderColor = config.buttonBorderColor;
                item.style.color = config.buttonTextColor;
                item.disabled = !config.enabled || runtime.isUploading;
                item.style.opacity = item.disabled ? "0.55" : "1";
                item.style.cursor = item.disabled ? "not-allowed" : "pointer";
            });

            runtime.canvas.style.pointerEvents = config.enabled ? "auto" : "none";
            runtime.canvas.style.cursor = config.enabled ? "crosshair" : "not-allowed";
            runtime.root.style.opacity = config.enabled ? "1" : "0.72";
        }

        function bindPadEvents() {
            if (!runtime.pad || runtime.pad._omniSignatureBound) return;
            runtime.pad._omniSignatureBound = true;

            function begin() {
                if (runtime.isDrawing) return;
                runtime.isDrawing = true;
                safePublishState("is_drawing", true);
                safeTrigger("signature_started");
            }

            function end() {
                runtime.isDrawing = false;
                safePublishState("is_drawing", false);
                publishDrawingState(true);
                safeTrigger("signature_ended");
                scheduleCommit();
            }

            if (typeof runtime.pad.addEventListener === "function") {
                runtime.pad.addEventListener("beginStroke", begin);
                runtime.pad.addEventListener("endStroke", end);
            }

            runtime.pad.onBegin = begin;
            runtime.pad.onEnd = end;
        }

        function ensurePad() {
            return loadSignaturePad().then(function(SignaturePad) {
                if (!runtime.pad) {
                    runtime.pad = new SignaturePad(runtime.canvas, {
                        penColor: runtime.config.penColor,
                        minWidth: runtime.config.minWidth,
                        maxWidth: runtime.config.maxWidth,
                        backgroundColor: runtime.config.backgroundColor,
                        minDistance: runtime.config.minDistance,
                        throttle: runtime.config.throttleMs
                    });
                    bindPadEvents();
                }

                runtime.pad.penColor = runtime.config.penColor;
                runtime.pad.minWidth = runtime.config.minWidth;
                runtime.pad.maxWidth = runtime.config.maxWidth;
                runtime.pad.backgroundColor = runtime.config.backgroundColor;
                runtime.pad.minDistance = runtime.config.minDistance;
                runtime.pad.throttle = runtime.config.throttleMs;
                runtime.helpers.setEnabled(runtime.config.enabled);
                resizeCanvas(true);
                applyInitialSignature();
                publishDrawingState(false);
                return runtime.pad;
            }).catch(function(error) {
                setError(error && error.message ? error.message : "Unable to initialize signature pad.");
            });
        }

        function scheduleResize() {
            if (runtime.resizeTimer) clearTimeout(runtime.resizeTimer);
            runtime.resizeTimer = setTimeout(function() {
                resizeCanvas(true);
            }, 50);
        }

        function resizeCanvas(preserve) {
            if (!runtime.canvas) return;

            var ratio = Math.max((typeof window !== "undefined" && window.devicePixelRatio) || 1, 1);
            var rect = runtime.stage ? runtime.stage.getBoundingClientRect() : runtime.canvas.getBoundingClientRect();
            var width = Math.max(1, Math.floor((rect.width || 1) * ratio));
            var height = Math.max(1, Math.floor((rect.height || 1) * ratio));
            var previous = null;

            if (runtime.pad && preserve && !runtime.pad.isEmpty()) {
                try {
                    previous = runtime.pad.toData();
                } catch (_error) {
                    previous = null;
                }
            }

            if (runtime.canvas.width !== width || runtime.canvas.height !== height) {
                runtime.canvas.width = width;
                runtime.canvas.height = height;
                var ctx = runtime.canvas.getContext("2d");
                if (ctx) ctx.scale(ratio, ratio);
                if (runtime.pad) {
                    runtime.pad.clear();
                    if (previous && previous.length) {
                        runtime.pad.fromData(previous);
                    }
                }
            }
        }

        function getStrokeCount() {
            if (!runtime.pad) return 0;
            try {
                return runtime.pad.toData().length;
            } catch (_error) {
                return 0;
            }
        }

        function exportDataUrl() {
            if (!runtime.pad || runtime.pad.isEmpty()) return "";
            var mime = runtime.config.outputFormat === "jpeg" ? "image/jpeg" : "image/png";
            if (runtime.config.outputFormat === "jpeg") {
                return runtime.pad.toDataURL(mime, runtime.config.jpegQuality);
            }
            return runtime.pad.toDataURL(mime);
        }

        function publishDrawingState(triggerChanged) {
            var empty = !runtime.pad || runtime.pad.isEmpty();
            var dataUrl = "";

            if (!empty) {
                try {
                    dataUrl = exportDataUrl();
                    setError("");
                } catch (error) {
                    setError(error && error.message ? error.message : "Unable to export signature image.");
                }
            }

            safePublishState("signature_data_url", dataUrl);
            safePublishState("is_empty", empty);
            safePublishState("stroke_count", getStrokeCount());
            if (runtime.placeholder) runtime.placeholder.style.display = empty ? "block" : "none";

            if (triggerChanged) safeTrigger("signature_changed");
        }

        function scheduleCommit() {
            if (runtime.config.commitBehavior !== "on_stroke_end") return;
            if (!runtime.pad || runtime.pad.isEmpty()) return;
            if (runtime.pendingCommitTimer) clearTimeout(runtime.pendingCommitTimer);
            runtime.pendingCommitTimer = setTimeout(function() {
                runtime.helpers.saveSignature(runtime.latestContext);
            }, runtime.config.commitDelayMs);
        }

        function sanitizePrefix(value) {
            value = String(value || "signature").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
            return value || "signature";
        }

        function fileNameForConfig() {
            var extension = runtime.config.outputFormat === "jpeg" ? "jpg" : "png";
            return sanitizePrefix(runtime.config.fileNamePrefix) + "-" + Date.now() + "." + extension;
        }

        function dataUrlToBase64(dataUrl) {
            var commaIndex = String(dataUrl || "").indexOf(",");
            return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
        }

        function dataUrlToFile(dataUrl, fileName) {
            var parts = String(dataUrl || "").split(",");
            var meta = parts[0] || "";
            var base64 = parts[1] || "";
            var match = /data:([^;]+);base64/i.exec(meta);
            var mime = match ? match[1] : "image/png";
            var binary = typeof atob === "function" ? atob(base64) : "";
            var length = binary.length;
            var bytes = new Uint8Array(length);
            for (var i = 0; i < length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            var blob = new Blob([bytes], { type: mime });
            try {
                return new File([blob], fileName, { type: mime });
            } catch (_error) {
                blob.name = fileName;
                blob.lastModified = Date.now();
                return blob;
            }
        }

        function uploadWithInstance(file) {
            return new Promise(function(resolve, reject) {
                if (!instance || typeof instance.uploadFile !== "function") {
                    reject(new Error("instance.uploadFile is not available."));
                    return;
                }

                var settled = false;
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
                    var result;
                    if (instance.uploadFile.length <= 2) {
                        result = instance.uploadFile(file, done);
                    } else {
                        result = instance.uploadFile(file.name || "signature", file, done);
                    }

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

        function uploadWithContext(dataUrl, uploadContext, fileName) {
            return new Promise(function(resolve, reject) {
                if (!uploadContext || typeof uploadContext.uploadContent !== "function") {
                    reject(new Error("No Bubble file upload utility is available."));
                    return;
                }

                try {
                    uploadContext.uploadContent(fileName, dataUrlToBase64(dataUrl), function(err, url) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(url || "");
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }

        function uploadDataUrl(dataUrl, uploadContext) {
            var fileName = fileNameForConfig();
            if (instance && typeof instance.uploadFile === "function") {
                return uploadWithInstance(dataUrlToFile(dataUrl, fileName)).catch(function(_error) {
                    return uploadWithContext(dataUrl, uploadContext, fileName);
                });
            }
            return uploadWithContext(dataUrl, uploadContext, fileName);
        }

        function applyInitialSignature() {
            var source = runtime.config.initialSignature || "";
            if (source === runtime.initialSignatureKey) return;
            runtime.initialSignatureKey = source;

            if (!runtime.pad) return;

            if (!source) {
                publishDrawingState(false);
                return;
            }

            var isDataUrl = /^data:image\//i.test(source);
            if (!isDataUrl && /^https?:\/\//i.test(source)) {
                safePublishState("value", source);
                safePublishAutobinding(source);
            }

            try {
                var result = runtime.pad.fromDataURL(source);
                if (result && typeof result.then === "function") {
                    result.then(function() {
                        publishDrawingState(false);
                    }).catch(function(error) {
                        setError(error && error.message ? error.message : "Unable to load the initial signature.");
                    });
                } else {
                    setTimeout(function() {
                        publishDrawingState(false);
                    }, 0);
                }
            } catch (error) {
                setError(error && error.message ? error.message : "Unable to load the initial signature.");
            }
        }

        runtime.helpers.saveSignature = function(uploadContext) {
            runtime.latestContext = uploadContext || runtime.latestContext;
            if (!runtime.pad) {
                setError("Signature pad is not ready.");
                return;
            }
            if (runtime.pad.isEmpty()) {
                setError("Signature is empty.");
                return;
            }
            if (runtime.isUploading) return;

            var dataUrl;
            try {
                dataUrl = exportDataUrl();
            } catch (error) {
                setError(error && error.message ? error.message : "Unable to export signature image.");
                return;
            }

            safePublishState("signature_data_url", dataUrl);
            runtime.isUploading = true;
            safePublishState("is_uploading", true);
            applyDomConfig();

            uploadDataUrl(dataUrl, runtime.latestContext).then(function(url) {
                if (!url) throw new Error("Bubble returned an empty upload URL.");
                safePublishState("value", url);
                safePublishAutobinding(url);
                safePublishState("last_error", "");
                safeTrigger("signature_saved");
            }).catch(function(error) {
                setError(error && error.message ? error.message : "Unable to upload signature image.");
            }).then(function() {
                runtime.isUploading = false;
                safePublishState("is_uploading", false);
                applyDomConfig();
            });
        };

        runtime.helpers.clearSignature = function() {
            if (runtime.pendingCommitTimer) clearTimeout(runtime.pendingCommitTimer);
            if (runtime.pad) runtime.pad.clear();
            safePublishState("value", null);
            safePublishAutobinding(null);
            safePublishState("signature_data_url", "");
            safePublishState("is_empty", true);
            safePublishState("is_drawing", false);
            safePublishState("stroke_count", 0);
            safePublishState("last_error", "");
            if (runtime.placeholder) runtime.placeholder.style.display = "block";
            safeTrigger("signature_cleared");
        };

        runtime.helpers.undoLastStroke = function() {
            if (!runtime.pad || runtime.pad.isEmpty()) return;

            var data = runtime.pad.toData();
            data.pop();
            runtime.pad.clear();
            if (data.length) runtime.pad.fromData(data);
            publishDrawingState(true);
            scheduleCommit();
        };

        runtime.helpers.setEnabled = function(enabled) {
            runtime.config.enabled = readBoolean({ enabled: enabled }, "enabled", true);
            if (runtime.pad) {
                if (runtime.config.enabled && typeof runtime.pad.on === "function") {
                    runtime.pad.on();
                } else if (!runtime.config.enabled && typeof runtime.pad.off === "function") {
                    runtime.pad.off();
                }
            }
            applyDomConfig();
        };

        runtime.update = function(properties, updateContext) {
            runtime.latestProperties = properties || runtime.latestProperties || {};
            runtime.latestContext = updateContext || runtime.latestContext || context || null;
            runtime.config = buildConfig(runtime.latestProperties);
            createDom();
            applyDomConfig();
            if (!runtime.canvas) {
                setError("Signature pad host is not ready.");
                return;
            }

            safePublishState("is_uploading", runtime.isUploading);
            safePublishState("is_drawing", runtime.isDrawing);
            ensurePad();
        };

        runtime.destroy = function() {
            if (runtime.resizeObserver && typeof runtime.resizeObserver.disconnect === "function") {
                runtime.resizeObserver.disconnect();
            }
            if (runtime.pendingCommitTimer) clearTimeout(runtime.pendingCommitTimer);
            if (runtime.resizeTimer) clearTimeout(runtime.resizeTimer);
        };

        instance.data.omniSignatureRuntime = runtime;

        safePublishState("value", null);
        safePublishState("signature_data_url", "");
        safePublishState("is_empty", true);
        safePublishState("is_drawing", false);
        safePublishState("is_uploading", false);
        safePublishState("stroke_count", 0);
        safePublishState("last_error", "");

        return runtime;
    };

    instance.data.omniSignatureBootstrap().update({}, context);
}
