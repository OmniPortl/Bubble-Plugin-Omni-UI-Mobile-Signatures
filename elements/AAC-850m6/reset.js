function(instance, context) {
  var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.destroy === "function") {
    runtime.destroy();
  }
  if (instance.data) {
    instance.data.omniSignatureRuntime = null;
  }
}
