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
  
  const [isPriceScaling, setIsPriceScaling] = useState(false);
  const [isTimeScaling, setIsTimeScaling] = useState(false);

  const [mouseX, setMouseX] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [showCrosshair, setShowCrosshair] = useState(false);
  
  // Touch/Pointer specific states
  const [activePointers, setActivePointers] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialTimeRange, setInitialTimeRange] = useState<number | null>(null);
  const [initialPriceRange, setInitialPriceRange] = useState<number | null>(null);
  
  // =================================== [ useEffects start ] =================================== 
  useEffect(()=>{

    const candleData: candleData[] = JSON.parse(rawData).values.slice(0,100); 
    setCandleData(candleData);

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

  },[minPrice, maxPrice, minTime, maxTime, mouseX, mouseY, showCrosshair])
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
        ctx.fillText(timeLabel, posX - 20, gridHeight + 20);
      }
    }

    // Horizontal
    let startingPrice = Math.ceil(minPrice / priceStep) * priceStep;
    for(let y=startingPrice; y <= maxPrice; y += priceStep){
      const posY = gridHeight - (y - minPrice) * priceScale; 
      if(posY >= 0 && posY <= gridHeight){
        ctx.moveTo(0,posY);
        ctx.lineTo(gridWidth,posY);
        ctx.fillStyle = theme.text;
        ctx.fillText(y.toFixed(5), gridWidth + 10, posY + 5);
      }
    }
    ctx.stroke();
    ctx.closePath();

    drawCandle(canvas, ctx, priceRange, timeRange, gridWidth, gridHeight, priceScale, timeScale);

    if(showCrosshair && mouseX !== null && mouseY !== null){
        drawCrosshair(canvas, ctx, priceRange, timeRange, gridWidth, gridHeight, priceScale, timeScale);
    }

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
        if(x >= gridWidth)continue;


        const yHigh = gridHeight - (Number(c.high) - minPrice) * priceScale;
        const yLow = gridHeight - (Number(c.low) - minPrice) * priceScale;
        const yOpen = gridHeight - (Number(c.open) - minPrice) * priceScale;
        const yClose = gridHeight - (Number(c.close) - minPrice) * priceScale;


        const color = Number(c.close) > Number(c.open) ? theme.bullish : theme.bearish;

        ctx.beginPath();
        ctx.moveTo(x,Math.min(yHigh, gridHeight));
        ctx.lineTo(x,Math.min(yLow, gridHeight));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();

        const bodyTop = Math.min(Math.min(yOpen, yClose),gridHeight);
        const bodyBottom = Math.min(Math.max(yOpen, yClose),gridHeight);
        ctx.fillStyle = color;
        ctx.fillRect(x - (candleWidth / 2), bodyTop, candleWidth, bodyBottom - bodyTop);

      }

    }
  // =================================== [ drawCandle end] =================================== 

  // =================================== [ drawCrosshair start ] =================================== 
    function drawCrosshair(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, priceRange: number, timeRange: number, gridWidth: number, gridHeight: number, priceScale: number, timeScale: number){
      if(!minPrice || !maxPrice || !minTime || !maxTime || mouseX ===  null || mouseY === null) return;

      if(mouseX < 0 || mouseX > gridWidth || mouseY < 0 || mouseY > gridHeight) return;

        ctx.save();
        
        ctx.strokeStyle = theme.text || '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); 
        ctx.globalAlpha = 0.7;

        ctx.beginPath();
        ctx.moveTo(mouseX, 0);
        ctx.lineTo(mouseX, gridHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, mouseY);
        ctx.lineTo(gridWidth, mouseY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        const priceAtCursor = minPrice + ((gridHeight - mouseY) / gridHeight) * priceRange;
        const timeAtCursor = minTime + (mouseX / gridWidth) * timeRange;

        ctx.fillStyle = theme.background || '#000000';
        ctx.strokeStyle = theme.text || '#ffffff';
        ctx.lineWidth = 1;
        
        const priceText = priceAtCursor.toFixed(5);
        const priceTextWidth = ctx.measureText(priceText).width;
        const priceLabelX = gridWidth + 2;
        const priceLabelY = mouseY - 6;
        const priceLabelHeight = 16;
        
        ctx.fillRect(priceLabelX - 2, priceLabelY - 2, priceTextWidth + 8, priceLabelHeight);
        ctx.strokeRect(priceLabelX - 2, priceLabelY - 2, priceTextWidth + 8, priceLabelHeight);
        
        ctx.fillStyle = theme.text || '#ffffff';
        ctx.fillText(priceText, priceLabelX + 2, priceLabelY + 10);

        ctx.fillStyle = theme.background || '#000000';
        ctx.strokeStyle = theme.text || '#ffffff';
        
        // const timeText = new Date(timeAtCursor).toLocaleTimeString("en-us", {hour12: false});
        const timeText = formatTimeLabel(new Date(timeAtCursor));
        const timeTextWidth = ctx.measureText(timeText).width;
        const timeLabelX = mouseX - timeTextWidth / 2;
        const timeLabelY = gridHeight + 2;
        const timeLabelHeight = 16;
        
        ctx.fillRect(timeLabelX - 4, timeLabelY, timeTextWidth + 8, timeLabelHeight);
        ctx.strokeRect(timeLabelX - 4, timeLabelY, timeTextWidth + 8, timeLabelHeight);
        
        ctx.fillStyle = theme.text || '#ffffff';
        ctx.fillText(timeText, timeLabelX, timeLabelY + 12);

        ctx.restore();

    }

  // =================================== [ drawCrosshair end ] =================================== 

  // =================================== [ formatTimeLabel for crosshair start ] =================================== 
    function formatTimeLabel(date: Date): string {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const dayName = days[date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${dayName} ${day} ${month} ${year}  ${hours}:${minutes}`;
    }
  // =================================== [ formatTimeLabel for crosshair end] =================================== 

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
    const canvas = canvasRef.current;

    if(canvas){
      const gridWidth = canvas.width - priceAxisWidth;
      const gridHeight = canvas.height - timeAxisHeight;

      if(e.clientX > gridWidth && e.clientX < canvas.width && e.clientY >= 0 && e.clientY <= gridHeight){
        setIsPriceScaling(true);
        setLastY(e.clientY);
        return;
      };

      if(e.clientY > gridHeight && e.clientY < canvas.height && e.clientX >= 0 && e.clientX <= gridWidth){
        setIsTimeScaling(true);
        setLastX(e.clientX);
        return;
      }

    }

    setLastX(e.clientX);
    setLastY(e.clientY);
    setIsDragging(true);
  }

  function onMouseMove(e: MouseEvent){
    const canvas = canvasRef.current;

    if(!canvas)return;

    const x = e.clientX;
    const y = e.clientY;

    setMouseX(x);
    setMouseY(y)

    if(!minPrice || !maxPrice || !minTime || !maxTime) return;

    if(isPriceScaling){
      const distanceMovedY = e.clientY - lastY;
      const scaleFactor = 1 + distanceMovedY / 600;

      const priceRange = maxPrice - minPrice;
      const centerPrice = (maxPrice + minPrice) / 2;
      const newPriceRange = priceRange * scaleFactor;

      setMinPrice(centerPrice - newPriceRange / 2);
      setMaxPrice(centerPrice + newPriceRange / 2);

      setLastY(e.clientY);
      return;
    };

    if(isTimeScaling){
      const distanceMovedX = e.clientX - lastX;
      const scaleFactor = 1 + distanceMovedX / 400;

      const timeRange = maxTime - minTime;
      const centerTime = (maxTime + minTime) / 2;
      const newTimeRange = timeRange * scaleFactor;

      setMinTime(centerTime - newTimeRange / 2);
      setMaxTime(centerTime + newTimeRange / 2);

      setLastX(e.clientX);
      return;
    }

    if(!isDragging)return;

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
    setIsPriceScaling(false);
    setIsTimeScaling(false);
  }

  function onMouseZoom(e: WheelEvent){
    if(!minPrice || !maxPrice || !minTime || !maxTime) return;
    const canvas = canvasRef.current;
    if(!canvas)return;
    const gridWidth = canvas.width - priceAxisWidth;
    // const gridHeight = canvas.height - timeAxisHeight;
    
    const x = e.nativeEvent.offsetX;
    // const y = e.nativeEvent.offsetY;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const timeRange = maxTime - minTime;
    // const priceRange = maxPrice - minPrice;

    const timeAtCursor = minTime + (x / gridWidth) * timeRange;
    const timeRatio = (timeAtCursor - minTime) / timeRange; 

    // const priceAtCursor = minPrice - ((gridHeight - y) / gridHeight) * priceRange;
    // const priceRatio = (priceAtCursor - minPrice) / priceRange;

    const newTimeRange = timeRange * zoomFactor; 
    // const newPriceRange = priceRange * priceZoomFactor;

    setMinTime(timeAtCursor - (newTimeRange * timeRatio));
    setMaxTime(timeAtCursor + (newTimeRange * (1 - timeRatio)));

    // setMinPrice(priceAtCursor - (newPriceRange * priceRatio));
    // setMaxPrice(priceAtCursor + (newPriceRange * (1 - priceRatio)));

  }

  function onMouseEnter(){
    setShowCrosshair(true);
  };

  function onMouseLeave(){
    setShowCrosshair(false);
    setMouseX(null);
    setMouseY(null);
  };

  // =================================== [ mouse event end ] =================================== 
  return (
    <div className="w-[100vw] h-[100vh] overflow-hidden p-5">
        <canvas
          className={`w-full h-full block border-2 cursor-crosshair ${isDragging && "cursor-grabbing"} ${isPriceScaling && "cursor-ns-resize"} ${isTimeScaling && "cursor-ew-resize"}`}
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onWheel={onMouseZoom}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          // TODO: add pointer pinch zoom handler when we have time
        ></canvas>
    </div>

  )
}

export default Chart