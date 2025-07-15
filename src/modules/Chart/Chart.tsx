import { useEffect, useRef } from "react"
import { theme } from "./variables";


const Chart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const gridSize = 100;

  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if(!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0,0,canvas.width, canvas.height);
    drawGrid(canvas, ctx)

  },[])

  function drawGrid(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D){
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 0.5;

    ctx.beginPath();

    // Vertical
    for(let x=0; x <= canvas.width; x += gridSize){
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }

    for(let y=0; y <= canvas.height; y += gridSize){
      ctx.moveTo(0,y);
      ctx.lineTo(canvas.width,y);
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