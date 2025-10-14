const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        mode: argv.mode || 'development',
        entry: './src/index.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js',
            publicPath: '/',
            clean: true,
        },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
        }),
    ],
    optimization: {
        splitChunks: isProduction ? {
            chunks: 'all',
        } : false,
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        port: 8080,
        hot: true,
        historyApiFallback: true,
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            {
                context: ['/socket.io'],
                target: 'http://localhost:3001',
                ws: true,
                changeOrigin: true,
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    };
};
