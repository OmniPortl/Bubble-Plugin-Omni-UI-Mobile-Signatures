function(instance, properties, context) {
  var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.update === "function") {
    runtime.update(properties || {}, context || {});
  }
}
