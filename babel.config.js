module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      useBuiltIns: 'usage',  // Add this
      corejs: 3.8 
    }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime'  // Add this
  ]
};