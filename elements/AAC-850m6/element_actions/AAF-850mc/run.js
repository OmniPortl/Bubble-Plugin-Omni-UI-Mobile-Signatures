function(instance, properties, context) {
  var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.clearSignature === "function") {
    runtime.clearSignature();
  }
}
