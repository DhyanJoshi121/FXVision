import { useEffect, useRef, useState } from "react"
import { ONE_HOUR, ONE_MINUTE, priceAxisWidth, theme, timeAxisHeight } from "./variables";


const Chart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [minPrice, setMinPrice] = useState<number>(100);
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [minTime, setMinTime] = useState<number>(Date.now() - (ONE_HOUR * 4));
  const [maxTime, setMaxTime] = useState<number>(Date.now());


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

  },[])

  function drawGrid(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D){
    const priceRange = maxPrice - minPrice;
    const stepSize = 10;
    const gridWidth = canvas.width - priceAxisWidth;
    const gridHeight = canvas.height - timeAxisHeight;

    ctx.beginPath();

    // Vertical
    let startingTime = minTime;
    for(let x=0; x <= canvas.width; x += gridSize){
      if(x >= gridWidth) break;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridHeight);
      ctx.fillStyle = theme.text;
      ctx.fillText(new Date(startingTime).toLocaleTimeString("en-us", {hour12: false}), x - 20, gridHeight + 10);
      startingTime += ONE_MINUTE * 30;
    }

    // Horizontal
    let startingPrice = maxPrice;
    for(let y=0; y <= canvas.height; y += gridSize){
      if(y >= gridHeight) break;
      ctx.moveTo(0,y);
      ctx.lineTo(gridWidth,y);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(startingPrice), gridWidth + 10, y + 5);
      startingPrice -= stepSize;
    }
    ctx.stroke();
    ctx.closePath();

  }

  return (
    <div className="w-[100vw] h-[100vh] overflow-hidden p-5">
        <canvas
          className="w-full h-full block border-2"
          ref={canvasRef}
        ></canvas>
    </div>

  )
}

export default Chart