const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const authorize = require("./middleware/auth");

// ================= MODELS =================
const User = require("./models/User");
const BarSale = require("./models/BarSale");
const Expense = require("./models/Expense");
const Room = require("./models/Room");
const Guest = require("./models/Guest");
const Staff = require("./models/Staff");
const Attendance = require("./models/Attendance");
const Salary = require("./models/Salary");
const Debit = require("./models/debit"); // ✅ FIXED casing

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log("WIMPY HMS SERVER STARTED");

// ================= DATABASE =================
mongoose.connect(
  "mongoose.connect(process.env.MONGO_URI)"
)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("Mongo Error:", err));

// ================= LOGIN =================
app.post("/login", async (req,res)=>{
  const user = await User.findOne(req.body);
  if(!user) return res.json({success:false});
  res.json({success:true, role:user.role});
});

// ================= STAFF =================
app.post("/add-staff", authorize(["manager"]), async(req,res)=>{
  await new Staff(req.body).save();
  res.json({message:"Staff added"});
});

app.get("/staff", authorize(["manager","accountant"]), async(req,res)=>{
  res.json(await Staff.find());
});

// ================= ATTENDANCE =================
app.post("/clock-in", authorize(["manager"]), async(req,res)=>{
  await new Attendance({ staff:req.body.staff }).save();
  res.json({message:"Clocked in"});
});

// ================= DEBITS =================
app.post("/add-debit", authorize(["manager","accountant"]), async(req,res)=>{
  await new Debit(req.body).save();
  res.json({message:"Debit added"});
});

// ================= AUTO PAY SALARY =================
app.post("/auto-pay-salary", authorize(["manager","accountant"]), async(req,res)=>{
  const { staffId, month } = req.body;

  const staff = await Staff.findById(staffId);
  if(!staff) return res.status(404).json({error:"Staff not found"});

  const start = new Date(month + "-01");
  const end = new Date(month + "-31");

  const daysWorked = await Attendance.countDocuments({
    staff: staffId,
    date: { $gte: start, $lte: end }
  });

  const dailyRate = staff.salary / 30;
  const gross = dailyRate * daysWorked;

  const debits = await Debit.find({ staff: staffId, month });
  const totalDebits = debits.reduce((a,b)=>a+b.amount,0);

  const netPay = gross - totalDebits;

  await new Salary({
    staff: staffId,
    gross,
    deductions: totalDebits,
    amount: netPay,
    month,
    daysWorked
  }).save();

  res.json({
    staff: staff.name,
    daysWorked,
    gross,
    totalDebits,
    netPay
  });
});

// ================= PAYSLIP PDF =================
app.get("/payslip/:id", authorize(["manager","accountant"]), async (req,res)=>{
  const salary = await Salary.findById(req.params.id).populate("staff");
  if(!salary) return res.status(404).send("Payslip not found");

  const doc = new PDFDocument({ margin:40 });
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition","inline; filename=payslip.pdf");
  doc.pipe(res);

  doc.fontSize(18).text("WIMPY HOTEL MANAGEMENT SYSTEM", {align:"center"});
  doc.moveDown();
  doc.fontSize(14).text("PAYSLIP", {align:"center"});
  doc.moveDown(2);

  doc.fontSize(12);
  doc.text(`Staff: ${salary.staff.name}`);
  doc.text(`Role: ${salary.staff.role}`);
  doc.text(`Month: ${salary.month}`);
  doc.moveDown();

  doc.text(`Gross: ₦${salary.gross}`);
  doc.text(`Deductions: ₦${salary.deductions}`);
  doc.font("Helvetica-Bold").text(`Net Pay: ₦${salary.amount}`);
  doc.font("Helvetica");

  doc.moveDown(2);
  doc.text("Authorized Signature: ____________________");

  doc.end();
});

// ================= PAYROLL SUMMARY PDF =================
app.get("/payroll-summary/:month",
  authorize(["manager","accountant"]),
  async (req,res)=>{
    const month = req.params.month;

    const salaries = await Salary.find({ month });
    const debits = await Debit.find({ month });

    const gross = salaries.reduce((a,b)=>a+b.amount,0);
    const totalDebits = debits.reduce((a,b)=>a+b.amount,0);

    const doc = new PDFDocument({ margin:40 });
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",`inline; filename=Payroll-${month}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text("WIMPY HOTEL & BAR", {align:"center"});
    doc.moveDown();
    doc.fontSize(14).text(`Payroll Summary — ${month}`, {align:"center"});
    doc.moveDown(2);

    doc.fontSize(12);
    doc.text(`Total Staff Paid: ${salaries.length}`);
    doc.text(`Gross Salaries: ₦${gross}`);
    doc.text(`Total Debits: ₦${totalDebits}`);
    doc.text(`Net Paid: ₦${gross - totalDebits}`);

    doc.end();
  }
);

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log("WIMPY HMS SERVER RUNNING ON", PORT));
