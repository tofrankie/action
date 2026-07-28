//#region src/index.ts
function noNodeApi() {
	throw new Error("@tofrankie/action does not provide a Node.js API. Use it as a GitHub Action or via CLI command `tofrankie-release`.");
}
//#endregion
export { noNodeApi as default };
