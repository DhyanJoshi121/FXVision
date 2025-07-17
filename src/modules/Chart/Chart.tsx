import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react"
import { ONE_DAY, ONE_HOUR, ONE_MINUTE, priceAxisWidth, theme, timeAxisHeight } from "./variables";
import type { candleData } from "./types";
import { rawData } from "./data";
// @ts-ignore
// import { fetchCandleData } from "./fetchCandleData.js"

const Chart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minTime, setMinTime] = useState<number | null>(null);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  /* ===========================================
   Added static dataInterval because the data I have is not perfect and if I try to take two candle and get the difference it might not come out right, because data has gaps.
   so for now we know that data is 30 so let's keep it 30.
  ===========================================  */
  const [dataInterval, setDataInterval] = useState<number>(ONE_MINUTE * 30);
  const [candleData, setCandleData] = useState<candleData[]>([]);;

  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // =================================== [ useEffects start ] =================================== 
  useEffect(()=>{

    const candleData: candleData[] = JSON.parse(rawData).values.slice(0,100); 
    setCandleData(candleData);
    console.log("hello: ", candleData);


    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if(!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    setMinPrice(Math.min(...candleData.map(c => Number(c.low))));
    setMaxPrice(Math.max(...candleData.map(c => Number(c.high))));

    setMaxTime(Number(new Date(candleData[0].datetime).getTime()));
    setMinTime(Number(new Date(candleData[candleData.length - 1].datetime).getTime()));

    window.addEventListener("mouseup",onMouseUp);

    return ()=>{
      window.removeEventListener("mouseup",onMouseUp);
    };

  },[])

  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if(!canvas || !ctx) return;
    

    ctx.clearRect(0,0,canvas.width,canvas.height);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 0.5;
    ctx.font = "12px Arial";
    drawGrid(canvas,ctx);

  },[minPrice, maxPrice, minTime, maxTime])
  // =================================== [ useEffects end ] =================================== 

  // =================================== [ drawGrid start ] =================================== 
  function drawGrid(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D){
    if(!minPrice || !maxPrice || !minTime || !maxTime) return;
    const priceRange = maxPrice - minPrice;
    const timeRange = maxTime - minTime;
    
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

    const timeStep = calculateTimeStep(timeRange, gridWidth / 50);
    const priceStep = calculateStep(priceRange, gridHeight / 70);

    const priceScale = gridHeight / priceRange;
    const timeScale = gridWidth / timeRange; 

    ctx.beginPath();

    // Vertical
    let startingTime = Math.ceil(minTime / timeStep) * timeStep;
    for(let x=startingTime; x <= maxTime; x += timeStep){
      const posX = (x - minTime) * timeScale;
      if(posX >= 0 && posX <= gridWidth){
        ctx.moveTo(posX, 0);
        ctx.lineTo(posX, gridHeight);
        ctx.fillStyle = theme.text;
        const timeLabel = new Date(x).toLocaleTimeString("en-us", {hour12: false});
        ctx.fillText(timeLabel, posX - 15, gridHeight + 10);
      }
    }

    // Horizontal
    let startingPrice = Math.ceil(minPrice / priceStep) * priceStep;
    for(let y=startingPrice; y <= maxPrice; y += priceStep){
      const posY = gridHeight - (y - minPrice) * priceScale; 
      if(posY >= 0 && posY <= gridHeight){
        ctx.moveTo(0,posY);
        ctx.lineTo(gridWidth,posY);
        ctx.fillStyle = "#fff";
        ctx.fillText(y.toFixed(5), gridWidth + 10, posY + 5);
      }
    }
    ctx.stroke();
    ctx.closePath();

    drawCandle(canvas, ctx, priceRange, timeRange, gridWidth, gridHeight, priceScale, timeScale);

  };
  // =================================== [ drawGrid end ] =================================== 

  // =================================== [ drawCandle start ] =================================== 
    function drawCandle(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, priceRange: number, timeRange: number, gridWidth: number, gridHeight: number, priceScale: number, timeScale: number ){
      if(!minPrice || !maxPrice || !minTime || !maxTime) return;
      
      const visibleCandles = timeRange / dataInterval;
      const candleWidth = (gridWidth / visibleCandles) * 0.8; 

      for(let i = 0; i <= candleData.length - 1; i++){
        const c = candleData[i]
        const time = Number(new Date(c.datetime));

        const x = (time - minTime) * timeScale;


        const yHigh = gridHeight - (Number(c.high) - minPrice) * priceScale;
        const yLow = gridHeight - (Number(c.low) - minPrice) * priceScale;
        const yOpen = gridHeight - (Number(c.open) - minPrice) * priceScale;
        const yClose = gridHeight - (Number(c.close) - minPrice) * priceScale;

        const color = Number(c.close) > Number(c.open) ? theme.bullish : theme.bearish;

        ctx.beginPath();
        ctx.moveTo(x,yHigh);
        ctx.lineTo(x,yLow);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();

        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        ctx.fillStyle = color;
        ctx.fillRect(x - (candleWidth / 2), bodyTop, candleWidth, bodyBottom - bodyTop);


      }

    }
  // =================================== [ drawCandle end] =================================== 

  // =================================== [ calculate steps start] =================================== 

    function calculateStep(range: number, targetSteps: number) {
        if (range <= 0 || targetSteps <= 0) return 1;
        const roughStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const residual = roughStep / magnitude;
        if (residual < 2) return magnitude; if (residual < 5) return 2 * magnitude;
        return 5 * magnitude;
    }

    function calculateTimeStep(range: number, targetSteps: number) {
        if (range <= 0 || targetSteps <= 0) return ONE_DAY;
        const roughStep = range / targetSteps;
        if(roughStep <= 30*ONE_MINUTE) return ONE_MINUTE * 30;
        const intervals = [ONE_MINUTE, 5*ONE_MINUTE, 15*ONE_MINUTE, 30*ONE_MINUTE, ONE_HOUR, 2*ONE_HOUR, 4*ONE_HOUR, 12*ONE_HOUR, ONE_DAY, 2*ONE_DAY, 4*ONE_DAY, 7*ONE_DAY];
        return intervals.find(i => i > roughStep) || intervals[intervals.length - 1];
    }
  // =================================== [ calculate steps end] =================================== 
  // =================================== [ mouse event start ] =================================== 
  function onMouseDown(e: MouseEvent){
    setLastX(e.clientX);
    setLastY(e.clientY);
    setIsDragging(true);
  }

  function onMouseMove(e: MouseEvent){
    if(!minPrice || !maxPrice || !minTime || !maxTime) return;
    const canvas = canvasRef.current;

    if(!canvas || !isDragging)return;

    const distanceMovedX = e.clientX - lastX;
    const distanceMovedY = e.clientY - lastY;

    const newTimeRange =  maxTime - minTime;
    const newPriceRange = maxPrice - minPrice;
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

    const timePerPixel = newTimeRange / gridWidth;
    const pricePerPixel = newPriceRange / gridHeight;

    const timeMoved = distanceMovedX * timePerPixel;
    const priceMoved = distanceMovedY * pricePerPixel;
    
    setMinTime(prev => prev! - timeMoved);
    setMaxTime(prev => prev! - timeMoved);
    setMinPrice(prev => prev! + priceMoved);
    setMaxPrice(prev => prev! + priceMoved);

    setLastX(e.clientX);
    setLastY(e.clientY);

  }

  function onMouseUp(e: globalThis.MouseEvent){
    setLastX(0);
    setLastY(0);
    setIsDragging(false);
  }

  function onMouseZoom(e: WheelEvent){
    if(!minPrice || !maxPrice || !minTime || !maxTime) return;
    const canvas = canvasRef.current;
    if(!canvas)return;
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;
    
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const timeRange = maxTime - minTime;
    const priceRange = maxPrice - minPrice;

    const timeAtCursor = minTime + (x / gridWidth) * timeRange;
    const timeRatio = (timeAtCursor - minTime) / timeRange; 

    const newTimeRange = timeRange * zoomFactor; 

    setMinTime(timeAtCursor - (newTimeRange * timeRatio));
    setMaxTime(timeAtCursor + (newTimeRange * (1 - timeRatio)));
  }
  // =================================== [ mouse event end ] =================================== 
  return (
    <div className="w-[100vw] h-[100vh] overflow-hidden p-5">
        <canvas
          className={`w-full h-full block border-2 ${isDragging && "cursor-grabbing"}`}
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onWheel={onMouseZoom}
        ></canvas>
    </div>

  )
}

export default Chart