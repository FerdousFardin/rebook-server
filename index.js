const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bg9iiek.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    //dbname and collections
    const rebookDB = client.db("reBOOK-DB");
    const categoriesCollection = rebookDB.collection("categories");
    const productsCollection = rebookDB.collection("products");
    //end collections
    app.post("/products", async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/categories", async (req, res) => {
      const categories = await categoriesCollection.find({}).toArray();
      res.send(categories);
    });
    app.get("/products", async (req, res) => {
      const products = await productsCollection.find({}).toArray();
      res.send(products);
    });
  } finally {
  }
}
run().catch((er) => console.error());
app.get("/", (req, res) => {
  res.send("Server is running");
});
app.listen(port, () => {
  console.log(`server is working on port ${port}`);
});
