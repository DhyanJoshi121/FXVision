import type { themeType } from "./types";

export const theme: themeType = {
    background: '#141823',
    grid: 'rgba(255, 255, 255, 0.1)', 
    text: 'rgba(255, 255, 255, 0.6)',
    bullish: '#26a69a', 
    bearish: '#ef5350',
    crosshair: 'rgba(255, 255, 255, 0.4)',
    axisLabelBackground: '#2a2e39',
};

export const priceAxisWidth = 60;
export const timeAxisHeight = 50;

export const ONE_MINUTE = 1000 * 60;
export const ONE_HOUR = ONE_MINUTE * 60;
export const ONE_DAY = ONE_HOUR * 24;
export const ONE_WORKING_WEEK = ONE_DAY * 5; 