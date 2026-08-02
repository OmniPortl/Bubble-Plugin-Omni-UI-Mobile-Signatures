function(instance, properties, context) {
  var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.setEnabled === "function") {
    var enabled = properties && properties.enabled;
    if (typeof enabled === "function") {
      try { enabled = enabled(); } catch (_error) { enabled = true; }
    }
    runtime.setEnabled(enabled);
  }
}
