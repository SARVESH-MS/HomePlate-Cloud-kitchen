// craco.config.js

module.exports = {
  style: {
    // This setting forces PostCSS to look for and use the
    // separate postcss.config.js file in your root folder.
    postcss: {
      mode: 'file', 
    },
  },
};