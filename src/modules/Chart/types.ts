export type themeType = {
    background: string;
    grid: string;
    text: string;
    bullish: string;
    bearish: string;
    crosshair: string;
    axisLabelBackground: string;
}

export type rawCandleData = {
    meta: {
        currency_base: string;
        currency_quote: string;
        interval: string;
        symbol: string;
        type: string;
    };
    status: string;
    values: candleData[]; 
};

export type candleData = {
    close: string;
    datetime: string;
    high: string;
    low: string;
    open: string;
};
