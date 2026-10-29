import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name:{type:String,required:true,trim:true,unique:true,maxlength:100 },
    image:{type:String,required:true },
    isActive:{type:Boolean,default:true},
}, { timestamps: true });
const Category = mongoose.models.Category || mongoose.model("Category",categorySchema);

export default Category;