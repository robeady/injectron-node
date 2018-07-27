// inspired by https://github.com/substack/insert-css/blob/master/index.js
function insert_css(css) {
    var styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    document.querySelector('head').appendChild(styleElement);
    if (styleElement.styleSheet) {
        styleElement.styleSheet.cssText += css;
    } else {
        styleElement.textContent += css;
    }
    return styleElement;
};
