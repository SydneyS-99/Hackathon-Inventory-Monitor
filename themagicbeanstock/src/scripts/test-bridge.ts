import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const testHandshake = () => {
  // path.resolve starts from the root folder, making the path absolute
  const pythonPath = path.resolve(process.cwd(), "ml", "venv", "bin", "python3");
  const scriptPath = path.resolve(process.cwd(), "ml", "predict.py");

  console.log("🚀 Testing Handshake with Absolute Paths...");
  console.log(`Python: ${pythonPath}`);
  
  if (!fs.existsSync(pythonPath)) {
    console.error("❌ Still cannot find Python! Double-check the spelling of 'venv' or 'ml'.");
    return;
  }

  const testData = { menuItemId: "MNU001", features: [6, 75, 0] };
  const py = spawn(pythonPath, [scriptPath]);
  
  let result = "";
  let errorOutput = "";

  py.stdin.write(JSON.stringify(testData));
  py.stdin.end();

  py.stdout.on('data', (d) => result += d.toString());
  py.stderr.on('data', (d) => errorOutput += d.toString());

  py.on('close', (code) => {
    if (code !== 0) {
      console.error("❌ Handshake Failed. Python said:", errorOutput);
    } else {
      console.log("✅ HANDSHAKE SUCCESS!");
      console.log("Prediction Result:", result);
    }
  });
};

testHandshake();