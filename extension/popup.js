"use strict";

const reloadButton =
    document.getElementById(
        "reload-button"
    );

reloadButton.addEventListener(
    "click",
    () => {
        chrome.runtime.reload();
    }
);