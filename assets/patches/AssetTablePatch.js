/**
 *	Cocos changed resource loading system to a crappy extensionless one in 1.1.0
 *	So we fix their ugly "deprecated" patch to a working solution
 */
cc.loader._getResUuid = function(url, type) {
	if(typeof(url) != 'string') return null;
	var extname = cc.path.extname(url).toLowerCase();
	if(extname) url = url.slice(0, - extname.length);
	if(extname && !type) {
		switch(extname) {
		case ".png":
			type = cc.SpriteFrame;
			break;
		case ".jpg":
			type = cc.SpriteFrame;
			break;
		case ".jpeg":
			type = cc.SpriteFrame;
			break;
		case ".json":
			type = cc.RawAsset;
			break;
		case ".plist":
			type = cc.SpriteAtlas;
			break;
		case ".prefab":
			type = cc.Prefab;
			break;
		}
	}
	return cc.loader._resources.getUuid(url, type);
};

/**
 *	 As of v1.1 cc.loader converts all url requrests into uuid requests and this conversion is case sensitive. And this is bad.
 */
var assetTable_add = cc.loader._resources.add.bind(cc.loader._resources);
cc.loader._resources.add = function(path, uuid, type, isMainAsset) {
	assetTable_add(path.toLowerCase(), uuid, type, isMainAsset);
};

// cc.url.normalize is used only in AssetTable.getUuid
cc.url.normalize = function (url) {
	if (url.charCodeAt(0) === 46 && url.charCodeAt(1) === 47) {
	// strip './'
	url = url.slice(2);
	}
	else if (url.charCodeAt(0) === 47) {
	// strip '/'
	url = url.slice(1);
	}
	return url.toLowerCase();
};