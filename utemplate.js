/*
 * Light Wrappers around underscore.template to allow compiling and rendering
 * of templates asyncronously. It also changes delimeters to Mustache-style:
 *   {{ var }} for interpolating values
 *   {% statements %} for executing arbitrary JavaScript code
 *
 * By Corey Schram
 */
var fs = require('fs'),
	underscore  = require('underscore');

underscore.templateSettings = {
	evaluate    : /\{%([\s\S]+?)%\}/g,
	interpolate : /\{\{([\s\S]+?)\}\}/g,
	include : /\{!([\s\S]+?)!\}/g
};

// Replaces all instances of the given substring.
String.prototype.replaceAll = function(strTarget, strSubString) {
	var strText = this,
		intIndexOfMatch = strText.indexOf(strTarget);
	while (intIndexOfMatch != -1){
		strText = strText.replace(strTarget, strSubString);
		intIndexOfMatch = strText.indexOf(strTarget);
	}
	return strText;
};

exports.setTemplateSettings = function (settings) {
	underscore.templateSettings = settings;
};

exports.Template = function (filename) {
	var that = this, queue = 0;
	this.defaults = {};
	this.callbacks = [];
	this.compiled = null;

	var that = this;
	fs.readFile(filename, function (err, data) {
		var i, text;
		if (err) {
			throw err;
		}

		data = data.toString('utf8');


		function deepInclude(match, file) {
			file = file.trim();
			queue++;
			fs.readFile(file, function (e, d) {
				if (e) {
					throw e;
				}
				d = d.toString('utf8');
				d.replace(underscore.templateSettings.include, deepInclude);
				data = data.replaceAll(match, d.toString('utf8'));
				queue--;
				if (queue === 0) {
					that.compiled = underscore.template(data);
					if (that.callbacks.length > 0) {
						for (i = 0; i < that.callbacks.length; i++) {
							try {
								text = that.compiled(that.callbacks[i][0]);
								that.callbacks[i][1](null, text);
							} catch (e) {
								that.callbacks[i][1](e);
							}
						}
						that.callbacks = [];
					}
				}
			});
		}
		data.replace(/\{!([\s\S]+?)!\}/g, deepInclude);
	});
};

exports.Template.prototype = {
	render : function (context, callback) {
		var text;
		context._ = underscore;
		if (this.compiled) {
			try {
				text = this.compiled(context);
				callback(null, text);
			} catch (e) {
				callback(e);
			}
		} else {
			this.callbacks[this.callbacks.length] = [
				context, callback
			];
		}
	}
};