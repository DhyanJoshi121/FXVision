import { useEffect, useRef, useState, type MouseEvent } from "react"
import { ONE_DAY, ONE_MINUTE, priceAxisWidth, theme, timeAxisHeight } from "./variables";


const Chart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [minPrice, setMinPrice] = useState<number>(100);
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [minTime, setMinTime] = useState<number>(Date.now() - ONE_DAY);
  const [maxTime, setMaxTime] = useState<number>(Date.now());

  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);


  const gridSize = 100;

  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if(!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 0.5;
    ctx.font = "12px Arial";
    drawGrid(canvas, ctx)

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

  function drawGrid(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D){
    const priceRange = maxPrice - minPrice;
    const timeRange = maxTime - minTime;

    const timeStep = ONE_MINUTE * 30;
    const priceStep = 10;

    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

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
        ctx.fillText(timeLabel.slice(0,5), posX - 15, gridHeight + 10);
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
        ctx.fillText(String(y), gridWidth + 10, posY + 5);
      }
    }
    ctx.stroke();
    ctx.closePath();

  };

  function onMouseDown(e: MouseEvent){
    setLastX(e.clientX);
    setLastY(e.clientY);
    setIsDragging(true);
  }

  function onMouseMove(e: MouseEvent){
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
    
    setMinTime(prev => prev - timeMoved);
    setMaxTime(prev => prev - timeMoved);
    setMinPrice(prev => prev + priceMoved);
    setMaxPrice(prev => prev + priceMoved);

    setLastX(e.clientX);
    setLastY(e.clientY);

  }

  function onMouseUp(e: globalThis.MouseEvent){
    setLastX(0);
    setLastY(0);
    setIsDragging(false);
  }
  return (
    <div className="w-[100vw] h-[100vh] overflow-hidden p-5">
        <canvas
          className={`w-full h-full block border-2 ${isDragging && "cursor-grabbing"}`}
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
        ></canvas>
    </div>

  )
}

export default Chart