# ouifennec-ext-settings

A WebExtension frontend for the Ouinet HTTP Settings API, and the CENO update page.

We use [web-ext](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Getting_started_with_web-ext) for development.

## Developing

Run `web-ext run` to test in a temporary profile on desktop (with live reload!), and `web-ext run --target=firefox-android` for same on mobile (more details and debugging instructions at [upstream docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Getting_started_with_web-ext#Testing_in_Firefox_for_Android)).

Please note that, in Desktop Firefox >= 60, the CENO Extension automatically changes the browser's proxies while enabled. In a different browser, you will need to change proxy settings manually.

## Distributing

To ship an updated version, update the git submodule in `https://github.com/censorship-no/gecko-dev/tree/ceno/mobile/android/extensions`.

## Internationalization (i18n)

I18n of the CENO Extension uses both [WebExtension i18n][webext-i18n] (for JavaScript and manifest) and rugk's [Localizer][] (with minor modifications).

[webext-i18n]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
[Localizer]: https://github.com/TinyWebEx/Localizer

To make a new HTML element/attribute localizable, a camel-case identifier like `somethingSomesubpartSomeother` is added as the value of the `data-i18n` or `data-i18n-<attribute>` attribute, and the string is added to `_locales/en/messages.json`. See Localizer's documentation for more information. Please note that identifiers in HTML files do not use the `__MSG_*__` format in this project.

Although the values of localizable HTML texts and attributes need not be in the HTML file, we choose to keep them to ease reading and testing the HTML file, in spite of the redundancy introduced and the need to keep the JSON and HTML texts in sync.

## Localization/translation (l10n)

When adding a new locale, remember to add the `_locales/<locale>/messages.json` and whatever other files used by the locale to the `moz.build` file, otherwise they will not be included in CENO Browser builds. Please check the comments in `moz.build` for more information.

When localizing a string with placeholders in the default language, like this one:

    "something": {
        "message": "This is a $TEST_STRING$ mentioned in $THIS_FILE$.",
        "placeholders": {
            "test_string": { "content": "$1" },
            "this_file": { "content": "$2"}
        }
    }

You may reorder them if needed:

    "something": {
        "message": "Esta cadena se menciona en $THIS_FILE$ y es una $TEST_STRING$."
        "placeholders": {
            "test_string": { "content": "$1" },
            "this_file": { "content": "$2"}
        }
    }

You can copy the definitions of the placeholders from the original English message entry (some translation tools do this automatically).
