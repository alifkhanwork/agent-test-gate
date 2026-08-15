export async function loadModule(moduleName: string) {
  // Unresolvable dynamic import
  const mod = await import(moduleName);
  return mod;
}
