import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type TouchEvent, type WheelEvent } from "react"
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

    // Use pointer events instead of mouse events for better cross-platform support
    const handlePointerUp = (e: globalThis.PointerEvent) => onPointerUp(e);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    // old mouseup events
    // window.addEventListener("mouseup",onMouseUp);

    // return ()=>{
    //   window.removeEventListener("mouseup",onMouseUp);
    // };

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

    canvas.addEventListener("wheel", onMouseZoom, { passive: false});

    return ()=>{
      canvas.removeEventListener("wheel", onMouseZoom); 
    };

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

// =================================== [ Helper functions start ] =================================== 
  function getDistance(pointer1: { x: number; y: number }, pointer2: { x: number; y: number }): number {
    const dx = pointer1.x - pointer2.x;
    const dy = pointer1.y - pointer2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getPointerPosition(e: PointerEvent | TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Pointer event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }
// =================================== [ Helper functions end ] =================================== 

// =================================== [ Pointer Events start ] =================================== 
  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture the pointer
    e?.pointerId && canvas.setPointerCapture(e.pointerId);

    const pos = getPointerPosition(e);
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

    // Add pointer to active pointers
    setActivePointers(prev => new Map(prev).set(e.pointerId, pos));

    // Check if we're in scaling zones (price axis or time axis)
    if (pos.x > gridWidth && pos.x < canvas.width && pos.y >= 0 && pos.y <= gridHeight) {
      setIsPriceScaling(true);
      setLastY(pos.y);
      return;
    }

    if (pos.y > gridHeight && pos.y < canvas.height && pos.x >= 0 && pos.x <= gridWidth) {
      setIsTimeScaling(true);
      setLastX(pos.x);
      return;
    }

    // For single pointer, start dragging
    if (activePointers.size === 0) {
      setLastX(pos.x);
      setLastY(pos.y);
      setIsDragging(true);
    }
  }

  function onPointerMove(e: PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getPointerPosition(e);
    setMouseX(pos.x);
    setMouseY(pos.y);

    if (!minPrice || !maxPrice || !minTime || !maxTime) return;

    // Update active pointer position
    const newActivePointers = new Map(activePointers);
    if (newActivePointers.has(e.pointerId)) {
      newActivePointers.set(e.pointerId, pos);
      setActivePointers(newActivePointers);
        console.log('hi1');
    }

    // Handle pinch zoom with two pointers
    if (newActivePointers.size === 2) {
      const pointers = Array.from(newActivePointers.values());
      const currentDistance = getDistance(pointers[0], pointers[1]);
        console.log('hi2');
      
      if (initialPinchDistance === null) {
        setInitialPinchDistance(currentDistance);
        setInitialTimeRange(maxTime - minTime);
        setInitialPriceRange(maxPrice - minPrice);
        console.log('hi3');
        return;
      }

      const scaleChange = currentDistance / initialPinchDistance;
      console.log("scaleChange",scaleChange);
      
      if (initialTimeRange && initialPriceRange) {
        console.log('hi4');
        const newTimeRange = initialTimeRange / scaleChange;
        const newPriceRange = initialPriceRange / scaleChange;
        
        const centerTime = (maxTime + minTime) / 2;
        const centerPrice = (maxPrice + minPrice) / 2;
        
        setMinTime(centerTime - newTimeRange / 2);
        setMaxTime(centerTime + newTimeRange / 2);
        setMinPrice(centerPrice - newPriceRange / 2);
        setMaxPrice(centerPrice + newPriceRange / 2);
      }
      return;
    }

    // Handle single pointer interactions
    if (isPriceScaling) {
      const distanceMovedY = pos.y - lastY;
      const scaleFactor = 1 + distanceMovedY / 600;

      const priceRange = maxPrice - minPrice;
      const centerPrice = (maxPrice + minPrice) / 2;
      const newPriceRange = priceRange * scaleFactor;

      setMinPrice(centerPrice - newPriceRange / 2);
      setMaxPrice(centerPrice + newPriceRange / 2);

      setLastY(pos.y);
      return;
    }

    if (isTimeScaling) {
      const distanceMovedX = pos.x - lastX;
      const scaleFactor = 1 + distanceMovedX / 400;

      const timeRange = maxTime - minTime;
      const centerTime = (maxTime + minTime) / 2;
      const newTimeRange = timeRange * scaleFactor;

      setMinTime(centerTime - newTimeRange / 2);
      setMaxTime(centerTime + newTimeRange / 2);

      setLastX(pos.x);
      return;
    }

    if (!isDragging) return;

    const distanceMovedX = pos.x - lastX;
    const distanceMovedY = pos.y - lastY;

    const newTimeRange = maxTime - minTime;
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

    setLastX(pos.x);
    setLastY(pos.y);
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement> | globalThis.PointerEvent) {
    const canvas = canvasRef.current;
    if (canvas && 'pointerId' in e) {
      canvas.releasePointerCapture(e.pointerId);
    }

    // Remove pointer from active pointers
    setActivePointers(prev => {
      const newMap = new Map(prev);
      newMap.delete(e.pointerId);
      return newMap;
    });

    // Reset states when no more active pointers
    if (activePointers.size <= 1) {
      setLastX(0);
      setLastY(0);
      setIsDragging(false);
      setIsPriceScaling(false);
      setIsTimeScaling(false);
      setInitialPinchDistance(null);
      setInitialTimeRange(null);
      setInitialPriceRange(null);
    }
  };
  // =================================== [ Pointer Events end ] =================================== 

  // =================================== [ Touch Events Start] =================================== 
  function onTouchStart(e: TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); // Prevent default touch behavior

    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const pos = getPointerPosition(e);
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

    // Handle multi-touch
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const rect = canvas.getBoundingClientRect();
      
      const pos1 = { x: touch1.clientX - rect.left, y: touch1.clientY - rect.top };
      const pos2 = { x: touch2.clientX - rect.left, y: touch2.clientY - rect.top };
      
      setInitialPinchDistance(getDistance(pos1, pos2));
      setInitialTimeRange(maxTime! - minTime!);
      setInitialPriceRange(maxPrice! - minPrice!);
      return;
    }

    // Single touch handling (similar to pointer)
    if (pos.x > gridWidth && pos.x < canvas.width && pos.y >= 0 && pos.y <= gridHeight) {
      setIsPriceScaling(true);
      setLastY(pos.y);
      return;
    }

    if (pos.y > gridHeight && pos.y < canvas.height && pos.x >= 0 && pos.x <= gridWidth) {
      setIsTimeScaling(true);
      setLastX(pos.x);
      return;
    }

    setLastX(pos.x);
    setLastY(pos.y);
    setIsDragging(true);
  }

  function onTouchMove(e: TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    
    if (!minPrice || !maxPrice || !minTime || !maxTime) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle pinch zoom
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const rect = canvas.getBoundingClientRect();
      
      const pos1 = { x: touch1.clientX - rect.left, y: touch1.clientY - rect.top };
      const pos2 = { x: touch2.clientX - rect.left, y: touch2.clientY - rect.top };
      
      const currentDistance = getDistance(pos1, pos2);
      
      if (initialPinchDistance && initialTimeRange && initialPriceRange) {
        const scaleChange = currentDistance / initialPinchDistance;
        
        const newTimeRange = initialTimeRange / scaleChange;
        const newPriceRange = initialPriceRange / scaleChange;
        
        const centerTime = (maxTime + minTime) / 2;
        const centerPrice = (maxPrice + minPrice) / 2;
        
        setMinTime(centerTime - newTimeRange / 2);
        setMaxTime(centerTime + newTimeRange / 2);
        setMinPrice(centerPrice - newPriceRange / 2);
        setMaxPrice(centerPrice + newPriceRange / 2);
      }
      return;
    }

    // Single touch movement
    const pos = getPointerPosition(e);
    setMouseX(pos.x);
    setMouseY(pos.y);

    if (isPriceScaling) {
      const distanceMovedY = pos.y - lastY;
      const scaleFactor = 1 + distanceMovedY / 600;

      const priceRange = maxPrice - minPrice;
      const centerPrice = (maxPrice + minPrice) / 2;
      const newPriceRange = priceRange * scaleFactor;

      setMinPrice(centerPrice - newPriceRange / 2);
      setMaxPrice(centerPrice + newPriceRange / 2);

      setLastY(pos.y);
      return;
    }

    if (isTimeScaling) {
      const distanceMovedX = pos.x - lastX;
      const scaleFactor = 1 + distanceMovedX / 400;

      const timeRange = maxTime - minTime;
      const centerTime = (maxTime + minTime) / 2;
      const newTimeRange = timeRange * scaleFactor;

      setMinTime(centerTime - newTimeRange / 2);
      setMaxTime(centerTime + newTimeRange / 2);

      setLastX(pos.x);
      return;
    }

    if (!isDragging) return;

    const distanceMovedX = pos.x - lastX;
    const distanceMovedY = pos.y - lastY;

    const newTimeRange = maxTime - minTime;
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

    setLastX(pos.x);
    setLastY(pos.y);
  }

  function onTouchEnd(e: TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    
    if (e.touches.length === 0) {
      setLastX(0);
      setLastY(0);
      setIsDragging(false);
      setIsPriceScaling(false);
      setIsTimeScaling(false);
      setInitialPinchDistance(null);
      setInitialTimeRange(null);
      setInitialPriceRange(null);
    }
  }
  // =================================== [ Touch Events end] =================================== 

  // =================================== [ Legacy mouse events for desktop start] =================================== 
  function onMouseDown(e: MouseEvent) {
    // Convert to pointer-like event
    const pointerEvent = {
      pointerId: -1, // Use -1 for mouse
      clientX: e.clientX,
      clientY: e.clientY,
      preventDefault: e.preventDefault.bind(e)
    } as PointerEvent<HTMLCanvasElement>;
    
    onPointerDown(pointerEvent);
  }

  function onMouseMove(e: MouseEvent) {
    const pointerEvent = {
      pointerId: -1,
      clientX: e.clientX,
      clientY: e.clientY,
      preventDefault: e.preventDefault.bind(e)
    } as PointerEvent;
    
    onPointerMove(pointerEvent);
  }

  function onMouseZoom(e: globalThis.WheelEvent) {
    let zoomFactor:number;
    if(e.ctrlKey){
      e.preventDefault();
      zoomFactor = e.deltaY > 0 ? 1.02 : 0.98;
    }else {
      zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    }

    if (!minPrice || !maxPrice || !minTime || !maxTime) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const gridWidth = canvas.width - priceAxisWidth;

    const x = e.offsetX;

    const timeRange = maxTime - minTime;
    const timeAtCursor = minTime + (x / gridWidth) * timeRange;
    const timeRatio = (timeAtCursor - minTime) / timeRange;

    const newTimeRange = timeRange * zoomFactor;

    setMinTime(timeAtCursor - (newTimeRange * timeRatio));
    setMaxTime(timeAtCursor + (newTimeRange * (1 - timeRatio)));
  }

  function onMouseEnter() {
    setShowCrosshair(true);
  }

  function onMouseLeave() {
    setShowCrosshair(false);
    setMouseX(null);
    setMouseY(null);
  }
  // =================================== [ Legacy mouse events for desktop end ] =================================== 


  return (
    <div className="w-[100vw] h-[100vh] overflow-hidden p-5" style={{touchAction: "none"}}>
        <canvas
          className={`w-full h-full block border-2 cursor-crosshair ${isDragging && "cursor-grabbing"} ${isPriceScaling && "cursor-ns-resize"} ${isTimeScaling && "cursor-ew-resize"}`}
          ref={canvasRef}
          // Pointer events (modern, works on all devices)
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          // Touch events (for better mobile support)
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          // Mouse events (legacy desktop support)
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={{ touchAction: 'none' }} 
        ></canvas>
    </div>

  )
}

export default Chart