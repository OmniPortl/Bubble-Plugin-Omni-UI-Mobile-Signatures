function(instance, context) {
  "use strict";
  var OmniSignatureBundle = (() => {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

    // src/entry.ts
    var entry_exports = {};
    __export(entry_exports, {
      initialize: () => initialize
    });

    // node_modules/signature_pad/dist/signature_pad.js
    var Point = class {
      constructor(x, y, pressure, time) {
        __publicField(this, "x");
        __publicField(this, "y");
        __publicField(this, "pressure");
        __publicField(this, "time");
        if (isNaN(x) || isNaN(y)) {
          throw new Error(`Point is invalid: (${x}, ${y})`);
        }
        this.x = +x;
        this.y = +y;
        this.pressure = pressure || 0;
        this.time = time || Date.now();
      }
      distanceTo(start) {
        return Math.sqrt(
          Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2)
        );
      }
      equals(other) {
        return this.x === other.x && this.y === other.y && this.pressure === other.pressure && this.time === other.time;
      }
      velocityFrom(start) {
        return this.time !== start.time ? this.distanceTo(start) / (this.time - start.time) : 0;
      }
    };
    var Bezier = class _Bezier {
      constructor(startPoint, control2, control1, endPoint, startWidth, endWidth) {
        this.startPoint = startPoint;
        this.control2 = control2;
        this.control1 = control1;
        this.endPoint = endPoint;
        this.startWidth = startWidth;
        this.endWidth = endWidth;
      }
      static fromPoints(points, widths) {
        const c2 = this.calculateControlPoints(points[0], points[1], points[2]).c2;
        const c3 = this.calculateControlPoints(points[1], points[2], points[3]).c1;
        return new _Bezier(points[1], c2, c3, points[2], widths.start, widths.end);
      }
      static calculateControlPoints(s1, s2, s3) {
        const dx1 = s1.x - s2.x;
        const dy1 = s1.y - s2.y;
        const dx2 = s2.x - s3.x;
        const dy2 = s2.y - s3.y;
        const m1 = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
        const m2 = { x: (s2.x + s3.x) / 2, y: (s2.y + s3.y) / 2 };
        const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const dxm = m1.x - m2.x;
        const dym = m1.y - m2.y;
        const k = l1 + l2 == 0 ? 0 : l2 / (l1 + l2);
        const cm = { x: m2.x + dxm * k, y: m2.y + dym * k };
        const tx = s2.x - cm.x;
        const ty = s2.y - cm.y;
        return {
          c1: new Point(m1.x + tx, m1.y + ty),
          c2: new Point(m2.x + tx, m2.y + ty)
        };
      }
      // Returns approximated length. Code taken from https://www.lemoda.net/maths/bezier-length/index.html.
      length() {
        const steps = 10;
        let length = 0;
        let px;
        let py;
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const cx = this.point(
            t,
            this.startPoint.x,
            this.control1.x,
            this.control2.x,
            this.endPoint.x
          );
          const cy = this.point(
            t,
            this.startPoint.y,
            this.control1.y,
            this.control2.y,
            this.endPoint.y
          );
          if (i > 0) {
            const xdiff = cx - px;
            const ydiff = cy - py;
            length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
          }
          px = cx;
          py = cy;
        }
        return length;
      }
      // Calculate parametric value of x or y given t and the four point coordinates of a cubic bezier curve.
      point(t, start, c1, c2, end) {
        return start * (1 - t) * (1 - t) * (1 - t) + 3 * c1 * (1 - t) * (1 - t) * t + 3 * c2 * (1 - t) * t * t + end * t * t * t;
      }
    };
    var SignatureEventTarget = class {
      /* tslint:enable: variable-name */
      constructor() {
        /* tslint:disable: variable-name */
        __publicField(this, "_et");
        try {
          this._et = new EventTarget();
        } catch {
          this._et = document;
        }
      }
      addEventListener(type, listener, options) {
        this._et.addEventListener(type, listener, options);
      }
      dispatchEvent(event) {
        return this._et.dispatchEvent(event);
      }
      removeEventListener(type, callback, options) {
        this._et.removeEventListener(type, callback, options);
      }
    };
    function throttle(fn, wait = 250) {
      let previous = 0;
      let timeout = null;
      let result;
      let storedContext;
      let storedArgs;
      const later = () => {
        previous = Date.now();
        timeout = null;
        result = fn.apply(storedContext, storedArgs);
        if (!timeout) {
          storedContext = null;
          storedArgs = [];
        }
      };
      return function wrapper(...args) {
        const now = Date.now();
        const remaining = wait - (now - previous);
        storedContext = this;
        storedArgs = args;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = now;
          result = fn.apply(storedContext, storedArgs);
          if (!timeout) {
            storedContext = null;
            storedArgs = [];
          }
        } else if (!timeout) {
          timeout = window.setTimeout(later, remaining);
        }
        return result;
      };
    }
    var SignaturePad = class _SignaturePad extends SignatureEventTarget {
      /* tslint:enable: variable-name */
      constructor(canvas, options = {}) {
        super();
        // Public stuff
        __publicField(this, "dotSize");
        __publicField(this, "minWidth");
        __publicField(this, "maxWidth");
        __publicField(this, "penColor");
        __publicField(this, "minDistance");
        __publicField(this, "velocityFilterWeight");
        __publicField(this, "compositeOperation");
        __publicField(this, "backgroundColor");
        __publicField(this, "throttle");
        __publicField(this, "canvasContextOptions");
        // Private stuff
        /* tslint:disable: variable-name */
        __publicField(this, "_ctx");
        __publicField(this, "_drawingStroke", false);
        __publicField(this, "_isEmpty", true);
        __publicField(this, "_dataUrl");
        __publicField(this, "_dataUrlOptions");
        __publicField(this, "_lastPoints", []);
        // Stores up to 4 most recent points; used to generate a new curve
        __publicField(this, "_data", []);
        // Stores all points in groups (one group per line or dot)
        __publicField(this, "_lastVelocity", 0);
        __publicField(this, "_lastWidth", 0);
        __publicField(this, "_strokeMoveUpdate");
        __publicField(this, "_strokePointerId");
        this.canvas = canvas;
        this.velocityFilterWeight = options.velocityFilterWeight || 0.7;
        this.minWidth = options.minWidth || 0.5;
        this.maxWidth = options.maxWidth || 2.5;
        this.throttle = options.throttle ?? 16;
        this.minDistance = options.minDistance ?? 5;
        this.dotSize = options.dotSize || 0;
        this.penColor = options.penColor || "black";
        this.backgroundColor = options.backgroundColor || "rgba(0,0,0,0)";
        this.compositeOperation = options.compositeOperation || "source-over";
        this.canvasContextOptions = options.canvasContextOptions ?? {};
        this._strokeMoveUpdate = this.throttle ? throttle(_SignaturePad.prototype._strokeUpdate, this.throttle) : _SignaturePad.prototype._strokeUpdate;
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
        this._handleTouchStart = this._handleTouchStart.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this);
        this._handleTouchEnd = this._handleTouchEnd.bind(this);
        this._handlePointerDown = this._handlePointerDown.bind(this);
        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);
        this._handlePointerCancel = this._handlePointerCancel.bind(this);
        this._handleTouchCancel = this._handleTouchCancel.bind(this);
        this._ctx = canvas.getContext(
          "2d",
          this.canvasContextOptions
        );
        this.clear();
        this.on();
      }
      clear() {
        const { _ctx: ctx, canvas } = this;
        ctx.fillStyle = this.backgroundColor;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this._data = [];
        this._reset(this._getPointGroupOptions());
        this._isEmpty = true;
        this._dataUrl = void 0;
        this._dataUrlOptions = void 0;
        this._strokePointerId = void 0;
      }
      redraw() {
        const data = this._data;
        const dataUrl = this._dataUrl;
        const dataUrlOptions = this._dataUrlOptions;
        this.clear();
        if (dataUrl) {
          this.fromDataURL(dataUrl, dataUrlOptions);
        }
        this.fromData(data, { clear: false });
      }
      fromDataURL(dataUrl, options = {}) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          const ratio = options.ratio || window.devicePixelRatio || 1;
          const width = options.width || this.canvas.width / ratio;
          const height = options.height || this.canvas.height / ratio;
          const xOffset = options.xOffset || 0;
          const yOffset = options.yOffset || 0;
          this._reset(this._getPointGroupOptions());
          image.onload = () => {
            this._ctx.drawImage(image, xOffset, yOffset, width, height);
            resolve();
          };
          image.onerror = (error) => {
            reject(error);
          };
          image.crossOrigin = "anonymous";
          image.src = dataUrl;
          this._isEmpty = false;
          this._dataUrl = dataUrl;
          this._dataUrlOptions = { ...options };
        });
      }
      toDataURL(type = "image/png", encoderOptions) {
        switch (type) {
          case "image/svg+xml":
            if (typeof encoderOptions !== "object") {
              encoderOptions = void 0;
            }
            return `data:image/svg+xml;base64,${btoa(
              this.toSVG(encoderOptions)
            )}`;
          default:
            if (typeof encoderOptions !== "number") {
              encoderOptions = void 0;
            }
            return this.canvas.toDataURL(type, encoderOptions);
        }
      }
      on() {
        this.canvas.style.touchAction = "none";
        this.canvas.style.msTouchAction = "none";
        this.canvas.style.userSelect = "none";
        this.canvas.style.webkitUserSelect = "none";
        const isIOS = /Macintosh/.test(navigator.userAgent) && "ontouchstart" in document;
        if (window.PointerEvent && !isIOS) {
          this._handlePointerEvents();
        } else {
          this._handleMouseEvents();
          if ("ontouchstart" in window) {
            this._handleTouchEvents();
          }
        }
      }
      off() {
        this.canvas.style.touchAction = "auto";
        this.canvas.style.msTouchAction = "auto";
        this.canvas.style.userSelect = "auto";
        this.canvas.style.webkitUserSelect = "auto";
        this.canvas.removeEventListener("pointerdown", this._handlePointerDown);
        this.canvas.removeEventListener("mousedown", this._handleMouseDown);
        this.canvas.removeEventListener("touchstart", this._handleTouchStart);
        this._removeMoveUpEventListeners();
      }
      _getListenerFunctions() {
        const canvasWindow = window.document === this.canvas.ownerDocument ? window : this.canvas.ownerDocument.defaultView ?? this.canvas.ownerDocument;
        return {
          addEventListener: canvasWindow.addEventListener.bind(
            canvasWindow
          ),
          removeEventListener: canvasWindow.removeEventListener.bind(
            canvasWindow
          )
        };
      }
      _removeMoveUpEventListeners() {
        const { removeEventListener } = this._getListenerFunctions();
        removeEventListener("pointermove", this._handlePointerMove);
        removeEventListener("pointerup", this._handlePointerUp);
        removeEventListener("pointercancel", this._handlePointerCancel);
        removeEventListener("mousemove", this._handleMouseMove);
        removeEventListener("mouseup", this._handleMouseUp);
        removeEventListener("touchmove", this._handleTouchMove);
        removeEventListener("touchend", this._handleTouchEnd);
        removeEventListener("touchcancel", this._handleTouchCancel);
      }
      isEmpty() {
        return this._isEmpty;
      }
      fromData(pointGroups, { clear = true } = {}) {
        if (clear) {
          this.clear();
        }
        this._fromData(
          pointGroups,
          this._drawCurve.bind(this),
          this._drawDot.bind(this)
        );
        this._data = this._data.concat(pointGroups);
      }
      toData() {
        return this._data;
      }
      _isLeftButtonPressed(event, only) {
        if (only) {
          return event.buttons === 1;
        }
        return (event.buttons & 1) === 1;
      }
      _pointerEventToSignatureEvent(event) {
        return {
          event,
          type: event.type,
          x: event.clientX,
          y: event.clientY,
          pressure: "pressure" in event ? event.pressure : 0
        };
      }
      _touchEventToSignatureEvent(event) {
        const touch = event.changedTouches[0];
        return {
          event,
          type: event.type,
          x: touch.clientX,
          y: touch.clientY,
          pressure: touch.force
        };
      }
      // Event handlers
      _handleMouseDown(event) {
        if (!this._isLeftButtonPressed(event, true) || this._drawingStroke) {
          return;
        }
        this._strokeBegin(this._pointerEventToSignatureEvent(event));
      }
      _handleMouseMove(event) {
        if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
          this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
          return;
        }
        this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
      }
      _handleMouseUp(event) {
        if (this._isLeftButtonPressed(event)) {
          return;
        }
        this._strokeEnd(this._pointerEventToSignatureEvent(event));
      }
      _handleTouchStart(event) {
        if (event.targetTouches.length !== 1 || this._drawingStroke) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        this._strokeBegin(this._touchEventToSignatureEvent(event));
      }
      _handleTouchMove(event) {
        if (event.targetTouches.length !== 1) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        if (!this._drawingStroke) {
          this._strokeEnd(this._touchEventToSignatureEvent(event), false);
          return;
        }
        this._strokeMoveUpdate(this._touchEventToSignatureEvent(event));
      }
      _handleTouchEnd(event) {
        if (event.targetTouches.length !== 0) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        this._strokeEnd(this._touchEventToSignatureEvent(event));
      }
      _handlePointerCancel(event) {
        if (!this._allowPointerId(event)) {
          return;
        }
        event.preventDefault();
        this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
      }
      _handleTouchCancel(event) {
        if (event.cancelable) {
          event.preventDefault();
        }
        this._strokeEnd(this._touchEventToSignatureEvent(event), false);
      }
      _getPointerId(event) {
        return event.persistentDeviceId || event.pointerId;
      }
      _allowPointerId(event, allowUndefined = false) {
        if (typeof this._strokePointerId === "undefined") {
          return allowUndefined;
        }
        return this._getPointerId(event) === this._strokePointerId;
      }
      _handlePointerDown(event) {
        if (this._drawingStroke || !this._isLeftButtonPressed(event) || !this._allowPointerId(event, true)) {
          return;
        }
        this._strokePointerId = this._getPointerId(event);
        event.preventDefault();
        this._strokeBegin(this._pointerEventToSignatureEvent(event));
      }
      _handlePointerMove(event) {
        if (!this._allowPointerId(event)) {
          return;
        }
        if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
          this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
          return;
        }
        event.preventDefault();
        this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
      }
      _handlePointerUp(event) {
        if (this._isLeftButtonPressed(event) || !this._allowPointerId(event)) {
          return;
        }
        event.preventDefault();
        this._strokeEnd(this._pointerEventToSignatureEvent(event));
      }
      _getPointGroupOptions(group) {
        return {
          penColor: group && "penColor" in group ? group.penColor : this.penColor,
          dotSize: group && "dotSize" in group ? group.dotSize : this.dotSize,
          minWidth: group && "minWidth" in group ? group.minWidth : this.minWidth,
          maxWidth: group && "maxWidth" in group ? group.maxWidth : this.maxWidth,
          velocityFilterWeight: group && "velocityFilterWeight" in group ? group.velocityFilterWeight : this.velocityFilterWeight,
          compositeOperation: group && "compositeOperation" in group ? group.compositeOperation : this.compositeOperation
        };
      }
      // Private methods
      _strokeBegin(event) {
        const cancelled = !this.dispatchEvent(
          new CustomEvent("beginStroke", { detail: event, cancelable: true })
        );
        if (cancelled) {
          return;
        }
        const { addEventListener } = this._getListenerFunctions();
        switch (event.event.type) {
          case "mousedown":
            addEventListener("mousemove", this._handleMouseMove, {
              passive: false
            });
            addEventListener("mouseup", this._handleMouseUp, { passive: false });
            break;
          case "touchstart":
            addEventListener("touchmove", this._handleTouchMove, {
              passive: false
            });
            addEventListener("touchend", this._handleTouchEnd, { passive: false });
            addEventListener("touchcancel", this._handleTouchCancel, { passive: false });
            break;
          case "pointerdown":
            addEventListener("pointermove", this._handlePointerMove, {
              passive: false
            });
            addEventListener("pointerup", this._handlePointerUp, {
              passive: false
            });
            addEventListener("pointercancel", this._handlePointerCancel, {
              passive: false
            });
            break;
          default:
        }
        this._drawingStroke = true;
        const pointGroupOptions = this._getPointGroupOptions();
        const newPointGroup = {
          ...pointGroupOptions,
          points: []
        };
        this._data.push(newPointGroup);
        this._reset(pointGroupOptions);
        this._strokeUpdate(event);
      }
      _strokeUpdate(event) {
        if (!this._drawingStroke) {
          return;
        }
        if (this._data.length === 0) {
          this._strokeBegin(event);
          return;
        }
        this.dispatchEvent(
          new CustomEvent("beforeUpdateStroke", { detail: event })
        );
        const point = this._createPoint(event.x, event.y, event.pressure);
        const lastPointGroup = this._data[this._data.length - 1];
        const lastPoints = lastPointGroup.points;
        const lastPoint = lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
        const isLastPointTooClose = lastPoint ? point.distanceTo(lastPoint) <= this.minDistance : false;
        const pointGroupOptions = this._getPointGroupOptions(lastPointGroup);
        if (!lastPoint || !(lastPoint && isLastPointTooClose)) {
          const curve = this._addPoint(point, pointGroupOptions);
          if (!lastPoint) {
            this._drawDot(point, pointGroupOptions);
          } else if (curve) {
            this._drawCurve(curve, pointGroupOptions);
          }
          lastPoints.push({
            time: point.time,
            x: point.x,
            y: point.y,
            pressure: point.pressure
          });
        }
        this.dispatchEvent(new CustomEvent("afterUpdateStroke", { detail: event }));
      }
      _strokeEnd(event, shouldUpdate = true) {
        this._removeMoveUpEventListeners();
        if (!this._drawingStroke) {
          return;
        }
        if (shouldUpdate) {
          this._strokeUpdate(event);
        }
        this._drawingStroke = false;
        this._strokePointerId = void 0;
        this.dispatchEvent(new CustomEvent("endStroke", { detail: event }));
      }
      _handlePointerEvents() {
        this._drawingStroke = false;
        this.canvas.addEventListener("pointerdown", this._handlePointerDown, {
          passive: false
        });
      }
      _handleMouseEvents() {
        this._drawingStroke = false;
        this.canvas.addEventListener("mousedown", this._handleMouseDown, {
          passive: false
        });
      }
      _handleTouchEvents() {
        this.canvas.addEventListener("touchstart", this._handleTouchStart, {
          passive: false
        });
      }
      // Called when a new line is started
      _reset(options) {
        this._lastPoints = [];
        this._lastVelocity = 0;
        this._lastWidth = (options.minWidth + options.maxWidth) / 2;
        this._ctx.fillStyle = options.penColor;
        this._ctx.globalCompositeOperation = options.compositeOperation;
      }
      _createPoint(x, y, pressure) {
        const rect = this.canvas.getBoundingClientRect();
        return new Point(
          x - rect.left,
          y - rect.top,
          pressure,
          (/* @__PURE__ */ new Date()).getTime()
        );
      }
      // Add point to _lastPoints array and generate a new curve if there are enough points (i.e. 3)
      _addPoint(point, options) {
        const { _lastPoints } = this;
        _lastPoints.push(point);
        if (_lastPoints.length > 2) {
          if (_lastPoints.length === 3) {
            _lastPoints.unshift(_lastPoints[0]);
          }
          const widths = this._calculateCurveWidths(
            _lastPoints[1],
            _lastPoints[2],
            options
          );
          const curve = Bezier.fromPoints(_lastPoints, widths);
          _lastPoints.shift();
          return curve;
        }
        return null;
      }
      _calculateCurveWidths(startPoint, endPoint, options) {
        const velocity = options.velocityFilterWeight * endPoint.velocityFrom(startPoint) + (1 - options.velocityFilterWeight) * this._lastVelocity;
        const newWidth = this._strokeWidth(velocity, options);
        const widths = {
          end: newWidth,
          start: this._lastWidth
        };
        this._lastVelocity = velocity;
        this._lastWidth = newWidth;
        return widths;
      }
      _strokeWidth(velocity, options) {
        return Math.max(options.maxWidth / (velocity + 1), options.minWidth);
      }
      _drawCurveSegment(x, y, width) {
        const ctx = this._ctx;
        ctx.moveTo(x, y);
        ctx.arc(x, y, width, 0, 2 * Math.PI, false);
        this._isEmpty = false;
      }
      _drawCurve(curve, options) {
        const ctx = this._ctx;
        const widthDelta = curve.endWidth - curve.startWidth;
        const drawSteps = Math.ceil(curve.length()) * 2;
        ctx.beginPath();
        ctx.fillStyle = options.penColor;
        for (let i = 0; i < drawSteps; i += 1) {
          const t = i / drawSteps;
          const tt = t * t;
          const ttt = tt * t;
          const u = 1 - t;
          const uu = u * u;
          const uuu = uu * u;
          let x = uuu * curve.startPoint.x;
          x += 3 * uu * t * curve.control1.x;
          x += 3 * u * tt * curve.control2.x;
          x += ttt * curve.endPoint.x;
          let y = uuu * curve.startPoint.y;
          y += 3 * uu * t * curve.control1.y;
          y += 3 * u * tt * curve.control2.y;
          y += ttt * curve.endPoint.y;
          const width = Math.min(
            curve.startWidth + ttt * widthDelta,
            options.maxWidth
          );
          this._drawCurveSegment(x, y, width);
        }
        ctx.closePath();
        ctx.fill();
      }
      _drawDot(point, options) {
        const ctx = this._ctx;
        const width = options.dotSize > 0 ? options.dotSize : (options.minWidth + options.maxWidth) / 2;
        ctx.beginPath();
        this._drawCurveSegment(point.x, point.y, width);
        ctx.closePath();
        ctx.fillStyle = options.penColor;
        ctx.fill();
      }
      _fromData(pointGroups, drawCurve, drawDot) {
        for (const group of pointGroups) {
          const { points } = group;
          const pointGroupOptions = this._getPointGroupOptions(group);
          if (points.length > 1) {
            for (let j = 0; j < points.length; j += 1) {
              const basicPoint = points[j];
              const point = new Point(
                basicPoint.x,
                basicPoint.y,
                basicPoint.pressure,
                basicPoint.time
              );
              if (j === 0) {
                this._reset(pointGroupOptions);
              }
              const curve = this._addPoint(point, pointGroupOptions);
              if (curve) {
                drawCurve(curve, pointGroupOptions);
              }
            }
          } else {
            this._reset(pointGroupOptions);
            drawDot(points[0], pointGroupOptions);
          }
        }
      }
      toSVG({ includeBackgroundColor = false, includeDataUrl = false } = {}) {
        const pointGroups = this._data;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const minX = 0;
        const minY = 0;
        const maxX = this.canvas.width / ratio;
        const maxY = this.canvas.height / ratio;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        svg.setAttribute("viewBox", `${minX} ${minY} ${maxX} ${maxY}`);
        svg.setAttribute("width", maxX.toString());
        svg.setAttribute("height", maxY.toString());
        if (includeBackgroundColor && this.backgroundColor) {
          const rect = document.createElement("rect");
          rect.setAttribute("width", "100%");
          rect.setAttribute("height", "100%");
          rect.setAttribute("fill", this.backgroundColor);
          svg.appendChild(rect);
        }
        if (includeDataUrl && this._dataUrl) {
          const ratio2 = this._dataUrlOptions?.ratio || window.devicePixelRatio || 1;
          const width = this._dataUrlOptions?.width || this.canvas.width / ratio2;
          const height = this._dataUrlOptions?.height || this.canvas.height / ratio2;
          const xOffset = this._dataUrlOptions?.xOffset || 0;
          const yOffset = this._dataUrlOptions?.yOffset || 0;
          const image = document.createElement("image");
          image.setAttribute("x", xOffset.toString());
          image.setAttribute("y", yOffset.toString());
          image.setAttribute("width", width.toString());
          image.setAttribute("height", height.toString());
          image.setAttribute("preserveAspectRatio", "none");
          image.setAttribute("href", this._dataUrl);
          svg.appendChild(image);
        }
        this._fromData(
          pointGroups,
          (curve, { penColor }) => {
            const path = document.createElement("path");
            if (!isNaN(curve.control1.x) && !isNaN(curve.control1.y) && !isNaN(curve.control2.x) && !isNaN(curve.control2.y)) {
              const attr = `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(
                3
              )} C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;
              path.setAttribute("d", attr);
              path.setAttribute("stroke-width", (curve.endWidth * 2.25).toFixed(3));
              path.setAttribute("stroke", penColor);
              path.setAttribute("fill", "none");
              path.setAttribute("stroke-linecap", "round");
              svg.appendChild(path);
            }
          },
          (point, { penColor, dotSize, minWidth, maxWidth }) => {
            const circle = document.createElement("circle");
            const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;
            circle.setAttribute("r", size.toString());
            circle.setAttribute("cx", point.x.toString());
            circle.setAttribute("cy", point.y.toString());
            circle.setAttribute("fill", penColor);
            svg.appendChild(circle);
          }
        );
        return svg.outerHTML;
      }
    };

    // src/bridge/bubble-bridge.ts
    var BubbleBridge = class {
      constructor(instance) {
        this.instance = instance;
      }
      publishState(name, value) {
        try {
          this.instance.publishState?.(name, value);
        } catch {
        }
      }
      publishAutobinding(value) {
        try {
          this.instance.publishAutobinding?.(value);
        } catch {
        }
      }
      triggerEvent(name) {
        try {
          this.instance.triggerEvent?.(name);
        } catch {
        }
      }
      publishInitialState() {
        this.publishState("value", null);
        this.publishState("signature_data_url", "");
        this.publishState("is_empty", true);
        this.publishState("is_drawing", false);
        this.publishState("is_uploading", false);
        this.publishState("stroke_count", 0);
        this.publishState("last_error", "");
      }
      error(message) {
        this.publishState("last_error", message);
        if (message) this.triggerEvent("signature_error");
      }
    };

    // src/config/signature-config.ts
    function readProperty(properties, name, fallback) {
      let value = properties[name];
      if (typeof value === "function") {
        try {
          value = value();
        } catch {
          value = fallback;
        }
      }
      return value === void 0 || value === null ? fallback : value;
    }
    function readText(properties, name, fallback = "") {
      let value = readProperty(properties, name, fallback);
      if (typeof value === "object" && value !== null) {
        const candidate = value;
        if (typeof candidate.url === "function") {
          try {
            value = candidate.url();
          } catch {
            value = fallback;
          }
        } else if (typeof candidate.url === "string") {
          value = candidate.url;
        } else if (typeof candidate.value === "string") {
          value = candidate.value;
        } else {
          value = fallback;
        }
      }
      return String(value ?? fallback);
    }
    function readBoolean(properties, name, fallback) {
      const value = readProperty(properties, name, fallback);
      if (value === "") return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      const normalized = String(value).trim().toLowerCase();
      if (["false", "no", "0", "off"].includes(normalized)) return false;
      if (["true", "yes", "1", "on"].includes(normalized)) return true;
      return fallback;
    }
    function readNumber(properties, name, fallback, min, max) {
      let value = Number(readProperty(properties, name, fallback));
      if (!Number.isFinite(value)) value = fallback;
      return Math.min(max, Math.max(min, value));
    }
    function readColor(properties, name, fallback) {
      const value = readProperty(properties, name, fallback);
      if (!value) return fallback;
      if (typeof value === "object") {
        const candidate = value;
        for (const key of ["css", "value", "color", "hex", "rgba", "rgb"]) {
          if (typeof candidate[key] === "string" && candidate[key]) return candidate[key];
        }
      }
      const text = String(value);
      return text === "[object Object]" ? fallback : text;
    }
    function normalizeConfig(properties = {}) {
      const minWidth = readNumber(properties, "min_width", 0.5, 0.1, 50);
      const outputFormat = readText(properties, "output_format", "png").toLowerCase() === "jpeg" ? "jpeg" : "png";
      const commitBehavior = readText(properties, "commit_behavior", "on_stroke_end").toLowerCase() === "manual" ? "manual" : "on_stroke_end";
      return {
        initialSignature: readText(properties, "initial_signature", ""),
        enabled: readBoolean(properties, "enabled", true),
        commitBehavior,
        commitDelayMs: Math.round(readNumber(properties, "commit_delay_ms", 500, 0, 1e4)),
        fileNamePrefix: readText(properties, "file_name_prefix", "signature") || "signature",
        outputFormat,
        jpegQuality: readNumber(properties, "jpeg_quality", 0.92, 0, 1),
        penColor: readColor(properties, "pen_color", "#111827"),
        minWidth,
        maxWidth: readNumber(properties, "max_width", 2.5, minWidth, 50),
        backgroundColor: readColor(properties, "background_color", "#ffffff"),
        minDistance: readNumber(properties, "min_distance", 5, 0, 50),
        throttleMs: Math.round(readNumber(properties, "throttle_ms", 16, 0, 1e3)),
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
    function sanitizeFilePrefix(value) {
      return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "signature";
    }

    // src/view/signature-view.ts
    var SignatureView = class {
      constructor(instance, actions) {
        const host = instance.canvas?.[0] ?? instance.canvas?.get?.(0);
        if (!host) throw new Error("Signature pad host is not ready.");
        instance.canvas.empty?.();
        host.innerHTML = "";
        this.root = document.createElement("div");
        this.toolbar = document.createElement("div");
        this.stage = document.createElement("div");
        this.canvas = document.createElement("canvas");
        this.placeholder = document.createElement("div");
        this.buttons = {
          undo: this.button("Undo", actions.undo),
          clear: this.button("Clear", actions.clear),
          save: this.button("Save", actions.save)
        };
        this.root.className = "omni-signature-root";
        this.toolbar.className = "omni-signature-toolbar";
        this.stage.className = "omni-signature-stage";
        this.canvas.className = "omni-signature-canvas";
        this.placeholder.className = "omni-signature-placeholder";
        this.toolbar.append(this.buttons.undo, this.buttons.clear, this.buttons.save);
        this.stage.append(this.canvas, this.placeholder);
        this.root.append(this.stage, this.toolbar);
        host.append(this.root);
        this.root.style.cssText = "box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:120px;overflow:hidden";
        this.stage.style.cssText = "position:relative;flex:1 1 auto;min-height:80px;overflow:hidden";
        this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:crosshair";
        this.placeholder.style.cssText = "position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;font-size:14px;opacity:.55";
        this.toolbar.style.cssText = "flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px;box-sizing:border-box";
        Object.values(this.buttons).forEach((item) => {
          item.style.cssText = "box-sizing:border-box;min-height:32px;padding:6px 12px;border-radius:6px;border-style:solid;border-width:1px;font:inherit;cursor:pointer";
        });
      }
      apply(config, isUploading) {
        this.root.style.backgroundColor = config.backgroundColor;
        this.stage.style.backgroundColor = config.backgroundColor;
        this.toolbar.style.backgroundColor = config.toolbarBackgroundColor;
        this.toolbar.style.display = config.showToolbar ? "flex" : "none";
        this.placeholder.textContent = config.placeholderText;
        this.buttons.undo.textContent = config.undoButtonLabel;
        this.buttons.clear.textContent = config.clearButtonLabel;
        this.buttons.save.textContent = config.saveButtonLabel;
        this.buttons.undo.style.display = config.showUndoButton ? "" : "none";
        this.buttons.clear.style.display = config.showClearButton ? "" : "none";
        this.buttons.save.style.display = config.showSaveButton ? "" : "none";
        Object.values(this.buttons).forEach((item) => {
          item.style.backgroundColor = config.buttonBackgroundColor;
          item.style.borderColor = config.buttonBorderColor;
          item.style.color = config.buttonTextColor;
          item.disabled = !config.enabled || isUploading;
          item.style.opacity = item.disabled ? "0.55" : "1";
          item.style.cursor = item.disabled ? "not-allowed" : "pointer";
        });
        this.canvas.style.pointerEvents = config.enabled ? "auto" : "none";
        this.canvas.style.cursor = config.enabled ? "crosshair" : "not-allowed";
        this.root.style.opacity = config.enabled ? "1" : "0.72";
      }
      showPlaceholder(show) {
        this.placeholder.style.display = show ? "block" : "none";
      }
      destroy() {
        this.root.remove();
      }
      button(label, action) {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = label;
        element.addEventListener("click", (event) => {
          event.preventDefault();
          action();
        });
        return element;
      }
    };

    // src/runtime/signature-runtime.ts
    var RUNTIME_KEY = "omniSignatureRuntime";
    var SignatureRuntime = class {
      constructor(instance, context) {
        this.instance = instance;
        this.config = normalizeConfig({});
        this.view = null;
        this.pad = null;
        this.resizeObserver = null;
        this.resizeTimer = null;
        this.pendingCommitTimer = null;
        this.initialSignatureKey = null;
        this.initialSignatureRevision = 0;
        this.isDrawing = false;
        this.isUploading = false;
        this.destroyed = false;
        this.handleBeginStroke = () => {
          if (this.isDrawing) return;
          this.isDrawing = true;
          this.bridge.publishState("is_drawing", true);
          this.bridge.triggerEvent("signature_started");
        };
        this.handleEndStroke = () => {
          this.isDrawing = false;
          this.bridge.publishState("is_drawing", false);
          this.publishDrawingState(true);
          this.bridge.triggerEvent("signature_ended");
          this.scheduleCommit();
        };
        this.scheduleResize = () => {
          if (this.resizeTimer) clearTimeout(this.resizeTimer);
          this.resizeTimer = setTimeout(() => this.resizeCanvas(true), 50);
        };
        this.latestContext = context;
        this.bridge = new BubbleBridge(instance);
        this.bridge.publishInitialState();
      }
      update(properties, context) {
        if (this.destroyed) return;
        this.latestContext = context || this.latestContext;
        this.config = normalizeConfig(properties || {});
        try {
          this.ensureView();
          this.ensurePad();
          this.applyPadConfig();
          this.view?.apply(this.config, this.isUploading);
          this.resizeCanvas(true);
          this.applyInitialSignature();
          this.bridge.publishState("is_uploading", this.isUploading);
          this.bridge.publishState("is_drawing", this.isDrawing);
          this.publishDrawingState(false);
        } catch (error) {
          this.bridge.error(messageOf(error, "Unable to initialize signature pad."));
        }
      }
      async saveSignature(context) {
        this.latestContext = context || this.latestContext;
        if (!this.pad) {
          this.bridge.error("Signature pad is not ready.");
          return;
        }
        if (this.pad.isEmpty()) {
          this.bridge.error("Signature is empty.");
          return;
        }
        if (this.isUploading) return;
        let dataUrl;
        try {
          dataUrl = this.exportDataUrl();
        } catch (error) {
          this.bridge.error(messageOf(error, "Unable to render signature image."));
          return;
        }
        this.bridge.publishState("signature_data_url", dataUrl);
        this.isUploading = true;
        this.bridge.publishState("is_uploading", true);
        this.view?.apply(this.config, true);
        try {
          const url = await this.uploadDataUrl(dataUrl, this.latestContext);
          if (!url) throw new Error("Bubble returned an empty upload URL.");
          this.bridge.publishState("value", url);
          this.bridge.publishAutobinding(url);
          this.bridge.publishState("last_error", "");
          this.bridge.triggerEvent("signature_saved");
        } catch (error) {
          this.bridge.error(messageOf(error, "Unable to upload signature image."));
        } finally {
          this.isUploading = false;
          this.bridge.publishState("is_uploading", false);
          this.view?.apply(this.config, false);
        }
      }
      clearSignature() {
        this.clearCommitTimer();
        this.initialSignatureRevision += 1;
        this.pad?.clear();
        this.bridge.publishState("value", null);
        this.bridge.publishAutobinding(null);
        this.bridge.publishState("signature_data_url", "");
        this.bridge.publishState("is_empty", true);
        this.bridge.publishState("is_drawing", false);
        this.bridge.publishState("stroke_count", 0);
        this.bridge.publishState("last_error", "");
        this.view?.showPlaceholder(true);
        this.bridge.triggerEvent("signature_cleared");
      }
      undoLastStroke() {
        if (!this.pad || this.pad.isEmpty()) return;
        const data = this.pad.toData();
        data.pop();
        this.pad.clear();
        if (data.length) this.pad.fromData(data);
        this.publishDrawingState(true);
        this.scheduleCommit();
      }
      setEnabled(enabled) {
        this.config.enabled = readBoolean({ enabled }, "enabled", true);
        if (this.config.enabled) this.pad?.on();
        else this.pad?.off();
        this.view?.apply(this.config, this.isUploading);
      }
      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.clearCommitTimer();
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeObserver?.disconnect();
        window.removeEventListener("resize", this.scheduleResize);
        this.pad?.off();
        this.pad = null;
        this.view?.destroy();
        this.view = null;
        if (this.instance.data[RUNTIME_KEY] === this) this.instance.data[RUNTIME_KEY] = null;
      }
      ensureView() {
        if (this.view) return;
        this.view = new SignatureView(this.instance, {
          undo: () => this.undoLastStroke(),
          clear: () => this.clearSignature(),
          save: () => {
            void this.saveSignature();
          }
        });
        if (typeof ResizeObserver !== "undefined") {
          this.resizeObserver = new ResizeObserver(this.scheduleResize);
          this.resizeObserver.observe(this.view.stage);
        } else {
          window.addEventListener("resize", this.scheduleResize);
        }
      }
      ensurePad() {
        if (this.pad || !this.view) return;
        this.pad = new SignaturePad(this.view.canvas, {
          penColor: this.config.penColor,
          minWidth: this.config.minWidth,
          maxWidth: this.config.maxWidth,
          backgroundColor: this.config.backgroundColor,
          minDistance: this.config.minDistance,
          throttle: this.config.throttleMs
        });
        this.pad.addEventListener("beginStroke", this.handleBeginStroke);
        this.pad.addEventListener("endStroke", this.handleEndStroke);
      }
      applyPadConfig() {
        if (!this.pad) return;
        this.pad.penColor = this.config.penColor;
        this.pad.minWidth = this.config.minWidth;
        this.pad.maxWidth = this.config.maxWidth;
        this.pad.backgroundColor = this.config.backgroundColor;
        this.pad.minDistance = this.config.minDistance;
        this.pad.throttle = this.config.throttleMs;
        this.setEnabled(this.config.enabled);
      }
      resizeCanvas(preserve) {
        if (!this.view) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = this.view.stage.getBoundingClientRect();
        const width = Math.max(1, Math.floor((rect.width || 1) * ratio));
        const height = Math.max(1, Math.floor((rect.height || 1) * ratio));
        let previous = null;
        if (this.pad && preserve && !this.pad.isEmpty()) previous = this.pad.toData();
        if (this.view.canvas.width === width && this.view.canvas.height === height) return;
        this.view.canvas.width = width;
        this.view.canvas.height = height;
        this.view.canvas.getContext("2d")?.scale(ratio, ratio);
        if (this.pad) {
          this.pad.clear();
          if (previous?.length) this.pad.fromData(previous);
        }
      }
      exportDataUrl() {
        if (!this.pad || this.pad.isEmpty()) return "";
        if (this.config.outputFormat === "jpeg") {
          return this.pad.toDataURL("image/jpeg", this.config.jpegQuality);
        }
        return this.pad.toDataURL("image/png");
      }
      publishDrawingState(triggerChanged) {
        const empty = !this.pad || this.pad.isEmpty();
        let dataUrl = "";
        if (!empty) {
          try {
            dataUrl = this.exportDataUrl();
            this.bridge.publishState("last_error", "");
          } catch (error) {
            this.bridge.error(messageOf(error, "Unable to render signature image."));
          }
        }
        this.bridge.publishState("signature_data_url", dataUrl);
        this.bridge.publishState("is_empty", empty);
        this.bridge.publishState("stroke_count", this.pad?.toData().length ?? 0);
        this.view?.showPlaceholder(empty);
        if (triggerChanged) this.bridge.triggerEvent("signature_changed");
      }
      scheduleCommit() {
        this.clearCommitTimer();
        if (this.config.commitBehavior !== "on_stroke_end" || !this.pad || this.pad.isEmpty()) return;
        this.pendingCommitTimer = setTimeout(() => {
          void this.saveSignature();
        }, this.config.commitDelayMs);
      }
      clearCommitTimer() {
        if (!this.pendingCommitTimer) return;
        clearTimeout(this.pendingCommitTimer);
        this.pendingCommitTimer = null;
      }
      applyInitialSignature() {
        const source = this.config.initialSignature;
        if (!this.pad || source === this.initialSignatureKey) return;
        this.initialSignatureKey = source;
        const revision = ++this.initialSignatureRevision;
        this.pad.clear();
        this.bridge.publishState("value", null);
        this.bridge.publishAutobinding(null);
        if (!source) {
          this.publishDrawingState(false);
          return;
        }
        if (!/^data:image\//i.test(source) && /^https?:\/\//i.test(source)) {
          this.bridge.publishState("value", source);
          this.bridge.publishAutobinding(source);
        }
        void this.pad.fromDataURL(source).then(() => {
          if (revision === this.initialSignatureRevision && !this.destroyed) this.publishDrawingState(false);
        }).catch((error) => {
          if (revision === this.initialSignatureRevision && !this.destroyed) {
            this.bridge.error(messageOf(error, "Unable to load the initial signature."));
          }
        });
      }
      fileName() {
        const extension = this.config.outputFormat === "jpeg" ? "jpg" : "png";
        return `${sanitizeFilePrefix(this.config.fileNamePrefix)}-${Date.now()}.${extension}`;
      }
      async uploadDataUrl(dataUrl, context) {
        const fileName = this.fileName();
        if (typeof this.instance.uploadFile === "function") {
          try {
            return await this.uploadWithInstance(dataUrlToFile(dataUrl, fileName));
          } catch {
            return this.uploadWithContext(dataUrl, context, fileName);
          }
        }
        return this.uploadWithContext(dataUrl, context, fileName);
      }
      uploadWithInstance(file) {
        return new Promise((resolve, reject) => {
          const upload = this.instance.uploadFile;
          if (typeof upload !== "function") return reject(new Error("instance.uploadFile is not available."));
          let settled = false;
          const done = (error, url) => {
            if (settled) return;
            settled = true;
            if (error) reject(error);
            else resolve(url || "");
          };
          try {
            const result = upload.length <= 2 ? upload(file, done) : upload(file.name || "signature", file, done);
            if (result && typeof result.then === "function") {
              void result.then((url) => done(null, url), done);
            } else if (typeof result === "string") {
              done(null, result);
            }
          } catch (error) {
            done(error);
          }
        });
      }
      uploadWithContext(dataUrl, context, fileName) {
        return new Promise((resolve, reject) => {
          if (typeof context?.uploadContent !== "function") {
            reject(new Error("No Bubble file upload utility is available."));
            return;
          }
          try {
            context.uploadContent(fileName, dataUrlToBase64(dataUrl), (error, url) => {
              if (error) reject(error);
              else resolve(url || "");
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    };
    function dataUrlToBase64(dataUrl) {
      const comma = dataUrl.indexOf(",");
      return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    }
    function dataUrlToFile(dataUrl, fileName) {
      const [meta = "", base64 = ""] = dataUrl.split(",", 2);
      const mime = /data:([^;]+);base64/i.exec(meta)?.[1] || "image/png";
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      try {
        return new File([bytes], fileName, { type: mime });
      } catch {
        const blob = new Blob([bytes], { type: mime });
        blob.name = fileName;
        blob.lastModified = Date.now();
        return blob;
      }
    }
    function messageOf(error, fallback) {
      return error instanceof Error && error.message ? error.message : fallback;
    }

    // src/entry.ts
    function initialize(instance, context) {
      instance.data || (instance.data = {});
      const previous = instance.data[RUNTIME_KEY];
      previous?.destroy?.();
      instance.data[RUNTIME_KEY] = new SignatureRuntime(instance, context || {});
    }
    return __toCommonJS(entry_exports);
  })();
  OmniSignatureBundle.initialize(instance, context || {});
}
