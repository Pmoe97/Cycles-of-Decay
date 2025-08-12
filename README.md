# Cycles of Decay

Interactive fiction project built with Twine (Twee3) + SugarCube 2.37.3 and tweego.

## Structure
```
/build              Compiled output (index.html)
/dev
  /twine            Twee story source passages (*.twee)
  /story            (Optional) Additional modular passage files
  /js               Custom JavaScript (e.g., macros, init)
  /styles           CSS
  /html             Extra HTML fragments injected into head/footer
/assets
  /images           Image assets (not compiled by tweego)
  /audio            Audio assets (not compiled by tweego)
```

## tweego compile command
Example (PowerShell):
```
tweego -o build/index.html -f sugarcube-2 dev/twine dev/story dev/js dev/styles
```
Explanation:
- `-f sugarcube-2` selects SugarCube 2 story format (ensure installed; tweego bundles some formats or place in PATH/formats directory).
- Head/footer fragment injection: tweego itself does not natively merge arbitrary HTML fragments like `-m` / `-a` (that was an idea for other toolchains). Instead, include external CSS/JS by referencing them inside SugarCube special passages (StoryStylesheet / StoryScript) or by bundling content directly in `.css` and `.js` files which tweego will inline.
- Order: directories are scanned; all `.twee` processed first, then JS/CSS assets in listed order.

## Special Passages Scaffolded
- StoryTitle
- StoryData
- StorySettings
- StoryCaption
- StoryAuthor
- StorySubtitle
- StoryBanner
- StoryStylesheet
- StoryScript
- StoryInit
- StoryMenu
- Start

## Adding New Passages
Create additional `.twee` files under `dev/story` or extend `story.twee`. Each passage begins with `:: PassageName [tags]`.

## Custom Macros
Add new JS files in `dev/js` and they will be bundled if given to tweego on the command line.

## Version Bump
Update the `format-version` in StoryData if targeting a newer SugarCube release.

## IFID
Replace `REPLACE-WITH-IFID` with a generated IFID (use https://www.tads.org/ifidgen/ or `tweego -g`).

## License
Add your licensing info here.
