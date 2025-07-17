import { useState } from "react";
import twelvedata from "twelvedata"

const client = twelvedata({
    key: import.meta.env.VITE_TWELVEDATA_API
})

export const fetchCandleData = async() => {
    let candleData;
    const params = {
        symbol: "EUR/USD",
        interval: "30min",
        start_date: "2015-01-01",
        end_date: "2025-07-13"
    };
    const cachedCandleData = localStorage.getItem('EURUSD');
    console.log("cached", Boolean(cachedCandleData));
    if(cachedCandleData){
        return cachedCandleData;
    };
    try {
        console.log('no')
        const res = await client.timeSeries(params)
        candleData = JSON.stringify(res);
        localStorage.setItem('EURUSD', JSON.stringify(res));
    } catch (error) {
        console.error("#error in fetching data: ", error);
    }

    return candleData;

}