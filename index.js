const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(400).send({ message: "Bad request." });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: "Forbidden." });
    }
    req.decoded = decoded;
    next();
  });
}
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const usersCollection = rebookDB.collection("users");
    const bookingsCollection = rebookDB.collection("bookings");
    //end collections
    app.post("/products", verifyJWT, async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/categories", async (req, res) => {
      const categories = await categoriesCollection.find({}).toArray();

      res.send(categories);
    });
    app.get("/products", verifyJWT, async (req, res) => {
      const { categoryId } = req.query;
      let query = {};
      if (categoryId) query = { categoryId };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });
    app.post("/users", async (req, res) => {
      // const { email } = req.decoded;
      const userInfo = req.body;
      // if (userInfo.email !== email)
      // return res.status(401).send({ message: "Unauthorized access." });
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // console.log(email);
      const user = await usersCollection.findOne(email);
      if (user) {
        const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        return res.send({ token });
      }
      res.status(403).send({ accessToken: "" });
    });
    app.get("/bookings", async (req, res) => {
      const bookings = await bookingsCollection.find({}).toArray();
      res.send(bookings);
    });
    app.post("/bookings", verifyJWT, async (req, res) => {
      const { email } = req.decoded;
      const bookingInfo = req.body;
      if (bookingInfo.customerEmail !== email)
        return res.status(401).send({ message: "Unauthorized access." });
      const result = await bookingsCollection.insertOne(bookingInfo);
      res.send(result);
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
