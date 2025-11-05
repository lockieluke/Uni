try {
  await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    target: "browser",
    packages: "external"
  });
} catch (e) {
  const error = e as AggregateError;
  console.log("Build failed with error", error.message);
}
