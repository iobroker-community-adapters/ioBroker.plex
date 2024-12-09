const axios = require('axios');

/**
 * Tests whether the given variable is a real object and not an Array
 *
 * @param it The variable to test
 * @returns {boolean} True if the variable is a real object, false otherwise
 */
function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === '[object Object]';
}

/**
 * Tests whether the given variable is really an Array
 *
 * @param it The variable to test
 * @returns {boolean} True if the variable is an array, false otherwise
 */
function isArray(it) {
    if (Array.isArray != null) {
        return Array.isArray(it);
    }
    return Object.prototype.toString.call(it) === '[object Array]';
}

/**
 * Choose the right tranalation API
 *
 * @param text The text to translate
 * @param targetLang The target languate
 * @param yandex api key
 * @returns {Promise<string>} The translated text
 */
async function translateText(text, targetLang, yandex) {
    if (targetLang === 'en') {
        return text;
    }
    if (yandex) {
        return await translateYandex(text, targetLang, yandex);
    }
    return await translateGoogle(text, targetLang);
}

/**
 * Translates text with Yandex API
 *
 * @param text The text to translate
 * @param targetLang The target languate
 * @param yandex api key
 * @returns {Promise<string>} The translated text
 */
async function translateYandex(text, targetLang, yandex) {
    if (targetLang === 'zh-cn') {
        targetLang = 'zh';
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${yandex}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await axios({ url, timeout: 15000 });
        if (response.data && response.data['text']) {
            return response.data['text'][0];
        }
        throw new Error('Invalid response for translate request');
    } catch (e) {
        throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
}

/**
 * Translates text with Google API
 *
 * @param text The text to translate
 * @param targetLang The target languate
 * @returns {Promise<string>} The translated text
 */
async function translateGoogle(text, targetLang) {
    try {
        const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
        const response = await axios({ url, timeout: 15000 });
        if (isArray(response.data)) {
            // we got a valid response
            return response.data[0][0][0];
        }
        throw new Error('Invalid response for translate request');
    } catch (e) {
        throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
}

module.exports = {
    isArray,
    isObject,
    translateText,
};
