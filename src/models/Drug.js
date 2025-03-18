import mongoose from 'mongoose';


const drugSchema = new mongoose.Schema({
  category_name: {
    type: String,
    default: ""
  },
  name: {
    type: String,
    default: ""
  },
  information: {
    type: Object,
    default: {}
  },
  link: {
    type: String,
    default: ""
  }
});

export default mongoose.model('Drug', drugSchema); 
