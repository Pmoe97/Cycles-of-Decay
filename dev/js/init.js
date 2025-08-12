/* SugarCube setup & initialization for Cycles of Decay */
(function () {
	'use strict';
	/* Called once on load */
	$(document).one(':storyready', function () {
		console.log('Cycles of Decay story ready');
	});

	/* Example: Global Config */
	Config.history.maxStates = 50; // tweak as needed
	Config.saves.autoload = true;

	/* Example: Setup object */
	setup.world = {
		version: '0.0.1',
		buildTime: new Date().toISOString()
	};

	/* Macro examples placeholder (add custom macros in separate file if desired) */
})();
