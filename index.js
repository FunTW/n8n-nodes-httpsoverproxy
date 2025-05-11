module.exports = {
	loadNodeTypes() {
		return {
			nodeTypes: [
				require('./dist/HttpsOverProxy.node').HttpsOverProxy,
			],
		};
	},
};
