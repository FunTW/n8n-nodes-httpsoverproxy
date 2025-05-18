module.exports = {
	loadNodeTypes() {
		return {
			nodeTypes: [
				require('./dist/nodes/HttpsOverProxy/HttpsOverProxy.node').HttpsOverProxy,
			],
		};
	},
};
