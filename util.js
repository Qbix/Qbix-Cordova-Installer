var path = require('path');
var shell = require('shelljs');
var fs = require('fs');

var Util = {
	
}

Util.File = {
	mkDir:function(src) {
    	shell.exec("mkdir -p "+ src);
	},
	rmDir:function(src) {
    	shell.exec("rm -rf "+ src);
	},
	writeFileSync:function(file, content) {
		fs.writeFileSync(file, content);
	},
	readFileSync:function(src) {
    	return fs.readFileSync(src, 'utf8')
	},
	rmFile:function(file) {
		fs.unlinkSync(file);
	},
	isExistPath:function(path) {
		return fs.existsSync(path)
	},
	isDir:function(src) {
    	return fs.lstatSync(src).isDirectory();
	},
	getDirs(path) {
	  return fs.readdirSync(path).filter(function (file) {
	    return fs.statSync(path+'/'+file).isDirectory();
	  });
	}
}

Util.Local = {
	getArrayLocale:function(localesConfig) {
    	var allLocales = [];
    	for(key in localesConfig) {
        	allLocales.push(key);
        	for(index in localesConfig[key]) {
            	var extLocal = localesConfig[key][index];
            	allLocales.push(key+"-"+extLocal);
        	}
    	}
    	return allLocales;
	},
	getLocaleFromArray:function(localeArray) {
    	var locales = {};
    	var localKey = undefined;
    	for(index in localeArray) {
        	var local = localeArray[index];
	        if(local.indexOf('-') > -1) {
	            var ext = local.split('-')[1];
	            if(locales[localKey] == undefined) {
	            	localKey= local.split('-')[0];
	            	locales[localKey] = [];
	            }
	            locales[localKey].push(ext);
	        } else {
	            localKey = local;
	            locales[localKey] = [];
	        }
    	}
    	return locales;
	},
	getDefaultSupportedLocales:function() {
    	var localesPath = path.join(__dirname, "mobile-store-local.json");
    	var locales = require(localesPath);
    	return locales;
	},
	// appConfig.deploy.locales
	getLocales:function(locales) {
		var defaultLocales = this.getArrayLocale(this.getDefaultSupportedLocales());
	    if(locales != undefined) {
	        var checkedLocales = [];
	        var userLocales = this.getArrayLocale(locales);
	        for(index in userLocales) {
	            if(defaultLocales.indexOf(userLocales[index]) > -1) {
	                checkedLocales.push(userLocales[index]);
	            }
	        }
	        return this.getLocaleFromArray(checkedLocales);
	    } else {
	        return this.getDefaultSupportedLocales();
	    }
	}
}

module.exports = Util;