/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global Node, odf, runtime, console, NodeFilter*/

runtime.loadClass("odf.OdfContainer");
runtime.loadClass("odf.StyleInfo");
runtime.loadClass("odf.OdfUtils");

/**
 * @constructor
 */
odf.Formatting = function Formatting() {
    "use strict";
    var /**@type{odf.OdfContainer}*/ odfContainer,
        /**@type{odf.StyleInfo}*/ styleInfo = new odf.StyleInfo(),
        /**@const@type {!string}*/ svgns = odf.Namespaces.svgns,
        /**@const@type {!string}*/ stylens = odf.Namespaces.stylens,
        odfUtils = new odf.OdfUtils();

    /**
     * Recursively merge properties of two objects
     * @param {!Object} destination
     * @param {!Object} source
     * @return {!Object}
     */
    function mergeRecursive(destination, source) {
        Object.keys(source).forEach(function(p) {
            try {
                // Property in destination object set; update its value.
                if (source[p].constructor === Object) {
                    destination[p] = mergeRecursive(destination[p], source[p]);
                } else {
                    destination[p] = source[p];
                }
            } catch (e) {
                // Property in destination object not set; create it and set its value.
                destination[p] = source[p];
            }
        });
        return destination;
    }

    /**
     * @param {!odf.OdfContainer} odfcontainer
     * @return {undefined}
     */
    this.setOdfContainer = function (odfcontainer) {
        odfContainer = odfcontainer;
    };

    /**
     * Returns a font face declarations map, where the key is the style:name and
     * the value is the svg:font-family or null, if none set but a svg:font-face-uri
     * @return {!Object.<string,string>}
     */
    this.getFontMap = function () {
        var fontFaceDecls = odfContainer.rootElement.fontFaceDecls,
            /**@type {!Object.<string,string>}*/
            fontFaceDeclsMap = {},
            node, name, family;

        node = fontFaceDecls && fontFaceDecls.firstChild;
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                name = node.getAttributeNS(stylens, 'name');
                if (name) {
                    // add family name as value, or, if there is a
                    // font-face-uri, an empty string
                    family = node.getAttributeNS(svgns, 'font-family');
                    if (family || node.getElementsByTagNameNS(svgns, 'font-face-uri')[0]) {
                        fontFaceDeclsMap[name] = family;
                    }
                }
            }
            node = node.nextSibling;
        }

        return fontFaceDeclsMap;
    };
    /**
     * Loop over the <style:style> elements and place the attributes
     * style:name and style:display-name in an array.
     * @return {!Array}
     */
    this.getAvailableParagraphStyles = function () {
        var node = odfContainer.rootElement.styles && odfContainer.rootElement.styles.firstChild,
            p_family,
            p_name,
            p_displayName,
            paragraphStyles = [],
            style;
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.localName === "style"
                    && node.namespaceURI === stylens) {
                style = node;
                p_family = style.getAttributeNS(stylens, 'family');
                if (p_family === "paragraph") {
                    p_name = style.getAttributeNS(stylens, 'name');
                    p_displayName = style.getAttributeNS(stylens, 'display-name') || p_name;
                    if (p_name && p_displayName) {
                        paragraphStyles.push({
                            name: p_name,
                            displayName: p_displayName
                        });
                    }
                }
            }
            node = node.nextSibling;
        }
        return paragraphStyles;
    };

    /**
     * Returns if the given style is used anywhere in the document.
     * @param {!Element} styleElement
     * @return {boolean}
     */
    this.isStyleUsed = function (styleElement) {
        var hasDerivedStyles, isUsed;

        hasDerivedStyles = styleInfo.hasDerivedStyles(odfContainer.rootElement, odf.Namespaces.resolvePrefix, styleElement);

        isUsed = new styleInfo.UsedStyleList(odfContainer.rootElement.styles).uses(styleElement)
            || new styleInfo.UsedStyleList(odfContainer.rootElement.automaticStyles).uses(styleElement)
            || new styleInfo.UsedStyleList(odfContainer.rootElement.body).uses(styleElement);

        return hasDerivedStyles || isUsed;
    };

    function getDefaultStyleElement(styleListElement, family) {
        var node = styleListElement.firstChild;

        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE
                    && node.namespaceURI === stylens
                    && node.localName === "default-style"
                    && node.getAttributeNS(stylens, 'family') === family) {
                return node;
            }
            node = node.nextSibling;
        }
        return null;
    }

    function getStyleElement(styleListElement, styleName, family) {
        var node = styleListElement.firstChild;

        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE
                    && node.namespaceURI === stylens
                    && node.localName === "style"
                    && node.getAttributeNS(stylens, 'family') === family
                    && node.getAttributeNS(stylens, 'name') === styleName) {
                return node;
            }
            node = node.nextSibling;
        }
        return null;
    }

    this.getStyleElement = getStyleElement;

    /**
     * Returns a JSON representation of the style attributes of a given style element
     * @param {!Node} styleNode
     * @return {!Object}
     */
    function getStyleAttributes(styleNode) {
        var i,
            propertiesMap = {},
            propertiesNode = styleNode.firstChild;

        while (propertiesNode) {
            if (propertiesNode.nodeType === Node.ELEMENT_NODE && propertiesNode.namespaceURI === stylens) {
                propertiesMap[propertiesNode.nodeName] = {};
                for (i = 0; i < propertiesNode.attributes.length; i += 1) {
                    propertiesMap[propertiesNode.nodeName][propertiesNode.attributes[i].name] = propertiesNode.attributes[i].value;
                }
            }
            propertiesNode = propertiesNode.nextSibling;
        }
        return propertiesMap;
    }

    /**
     * Returns a JSON representation of the style attributes of a given style element, also containing attributes
     * inherited from it's ancestry - up to and including the default style for the family.
     * @param {!Element} styleListElement
     * @param {!Node} styleNode
     * @return {!Object}
     */
    function getInheritedStyleAttributes(styleListElement, styleNode) {
        var parentStyleName,
            propertiesMap = {},
            inheritedPropertiesMap = {},
            node = styleNode;

        // Iterate through the style ancestry
        while (node) {
            propertiesMap = getStyleAttributes(node);
            // All child properties should override any matching parent properties
            inheritedPropertiesMap = mergeRecursive(propertiesMap, inheritedPropertiesMap);

            parentStyleName = node.getAttributeNS(stylens, 'parent-style-name');
            if (parentStyleName) {
                node = getStyleElement(styleListElement, parentStyleName, styleNode.getAttributeNS(stylens, 'family'));
            } else {
                node = null;
            }
        }

        // Now incorporate attributes from the default style
        node = getDefaultStyleElement(styleListElement, styleNode.getAttributeNS(stylens, 'family'));
        if(node) {
            propertiesMap = getStyleAttributes(node);
            // All child properties should override any matching parent properties
            inheritedPropertiesMap = mergeRecursive(propertiesMap, inheritedPropertiesMap);
        }
        return inheritedPropertiesMap;
    }

    this.getInheritedStyleAttributes = getInheritedStyleAttributes;

    /**
     * Get the name of the first named style in the parent style chain.
     * If none is found, null is returned and you should assume the Default style.
     * @param {!string} styleName
     * @return {!string|null}
     */
    this.getFirstNamedParentStyleNameOrSelf = function (styleName) {
        var automaticStyleElementList = odfContainer.rootElement.automaticStyles,
            styleElementList = odfContainer.rootElement.styles,
            styleElement;

        // first look for automatic style with the name
        while ((styleElement = getStyleElement(automaticStyleElementList, styleName, "paragraph")) !== null) {
            styleName = styleElement.getAttributeNS(stylens, 'parent-style-name');
        }
        // then see if that style is in named styles
        styleElement = getStyleElement(styleElementList, styleName, "paragraph");
        if (!styleElement) {
            return null;
        }
        return styleName;
    };

    /**
     * Returns if there is an automatic or named paragraph style with the given name.
     * @param {!string} styleName
     * @return {!boolean}
     */
    this.hasParagraphStyle = function (styleName) {
        return (getStyleElement(odfContainer.rootElement.automaticStyles, styleName, "paragraph") ||
                getStyleElement(odfContainer.rootElement.styles, styleName, "paragraph"));
    };

    /**
     * Get the value of the attribute with the given name from the style with the given name
     * or, if not set there, from the first style in the chain of parent styles where it is set.
     * If the attribute is not found, null is returned.
     * @param {!string} styleName
     * @param {!string} attributeNameNS
     * @param {!string} attributeName
     * @return {!string|null}
     */
    this.getParagraphStyleAttribute = function (styleName, attributeNameNS, attributeName) {
        var automaticStyleElementList = odfContainer.rootElement.automaticStyles,
            styleElementList = odfContainer.rootElement.styles,
            styleElement,
            attributeValue;

        // first look for automatic style with the attribute
        while ((styleElement = getStyleElement(automaticStyleElementList, styleName, "paragraph")) !== null) {
            attributeValue = styleElement.getAttributeNS(attributeNameNS, attributeName);
            if (attributeValue) {
                return attributeValue;
            }
            styleName = styleElement.getAttributeNS(stylens, 'parent-style-name');
        }
        // then see if that style is in named styles
        while ((styleElement = getStyleElement(styleElementList, styleName, "paragraph")) !== null) {
            attributeValue = styleElement.getAttributeNS(attributeNameNS, attributeName);
            if (attributeValue) {
                return attributeValue;
            }
            styleName = styleElement.getAttributeNS(stylens, 'parent-style-name');
        }
        return null;
    };

    /**
     * Builds up a style chain for a given node by climbing up all parent nodes and checking for style information
     * @param {!Node} node
     * @param {Object.<string, Array.<Object>>} [collectedChains=] Dictionary to add any new style chains to
     * @returns {Array.<Object>|undefined}
     */
    function buildStyleChain(node, collectedChains) {
        var parent = node.nodeType === Node.TEXT_NODE ? node.parentNode : node,
            nodeStyles,
            appliedStyles = [],
            chainKey = '',
            foundContainer = false;
        while(parent) {
            if(!foundContainer && odfUtils.isGroupingElement(parent)) {
                foundContainer = true;
            }
            nodeStyles = styleInfo.determineStylesForNode(/**@type {!Element}*/(parent));
            if(nodeStyles) {
                appliedStyles.push(nodeStyles);
            }
            parent = parent.parentNode;
        }

        if(foundContainer) {
            appliedStyles.forEach(function(usedStyleMap) {
                Object.keys(usedStyleMap).forEach(function(styleFamily) {
                    Object.keys(usedStyleMap[styleFamily]).forEach(function(styleName) {
                        chainKey += '|' + styleFamily + ':' + styleName + '|';
                    });
                });
            });
            if (collectedChains) {
                collectedChains[chainKey] = appliedStyles;
            }
        }

        return foundContainer ? appliedStyles : undefined;
    }

    /**
     * Takes a provided style chain and calculates the resulting inherited style, starting from the outer-most to the
     * inner-most style
     * @param {Array.<Object>} styleChain Ordered list starting from inner-most style to outer-most style
     * @param {!Element} automaticStyleElementList
     * @param {!Element} styleElementList
     * @returns {Object}
     */
    function calculateAppliedStyle(styleChain, automaticStyleElementList, styleElementList) {
        var mergedChildStyle = { orderedStyles: [] };

        // The complete style is built up by starting at the base known style and merging each new entry
        // on top of it, so the inner-most style properties override the outer-most
        styleChain.forEach(function(elementStyleSet) {
            Object.keys(/**@type {!Object}*/(elementStyleSet)).forEach(function(styleFamily) {
                // Expect there to only be a single style for a given family per element (e.g., 1 text, 1 paragraph)
                var styleName = Object.keys(elementStyleSet[styleFamily])[0],
                    styleElement,
                    parentStyle;

                styleElement = getStyleElement(automaticStyleElementList, styleName, styleFamily)
                    || getStyleElement(styleElementList, styleName, styleFamily);

                parentStyle = getInheritedStyleAttributes(styleElementList, styleElement);
                mergedChildStyle = mergeRecursive(parentStyle, mergedChildStyle);
                mergedChildStyle.orderedStyles.push({
                    name: styleName,
                    family: styleFamily,
                    displayName: styleElement.getAttributeNS(stylens, 'display-name')
                });
            });
        });
        return mergedChildStyle;
    }

    /**
     * Returns an array of all unique styles in a given range for each text node
     * @param {Range} range
     * @returns {Array.<Object>}
     */
    this.getAppliedStyles = function(range) {
        var document = runtime.getWindow().document,
            root = /**@type {!Node}*/ (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ?
                range.commonAncestorContainer.parentNode : range.commonAncestorContainer),
            nodeRange = document.createRange(),
            iterator = document.createTreeWalker(root,
                NodeFilter.SHOW_ALL,
                function(node) {
                    nodeRange.selectNode(node);
                    if(range.compareBoundaryPoints(range.END_TO_START, nodeRange) === -1 &&
                        range.compareBoundaryPoints(range.START_TO_END, nodeRange) === 1) {
                        return node.nodeType === Node.TEXT_NODE ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_REJECT;
                },
                false),
            automaticStyleElementList = odfContainer.rootElement.automaticStyles,
            styleElementList = odfContainer.rootElement.styles,
            styleChains = {},
            n = iterator.nextNode(),
            styles = [];

        while(n) {
            buildStyleChain(n, styleChains);
            n = iterator.nextNode();
        }

        Object.keys(styleChains).forEach(function(key) {
            styles.push(calculateAppliedStyle(styleChains[key], automaticStyleElementList, styleElementList));
        });

        nodeRange.detach();
        return styles;
    };

    /**
     * Returns a the applied style to the current node
     * @param {!Element} node
     * @returns {Object|undefined}
     */
    this.getAppliedStylesForElement = function(node) {
        var automaticStyleElementList = odfContainer.rootElement.automaticStyles,
            styleElementList = odfContainer.rootElement.styles,
            styleChain,
            appliedStyle;

        styleChain = buildStyleChain(node);
        appliedStyle = styleChain && calculateAppliedStyle(styleChain, automaticStyleElementList, styleElementList);
        return appliedStyle;
    };
};
