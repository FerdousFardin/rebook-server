const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(400).send({ message: "Bad request." });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (error, decoded) {
    if (error) {
      console.error(error);
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

    //verify roles
    function hasRoles(roles) {
      return async function (req, res, next) {
        const { email } = req.decoded;
        const user = await usersCollection.findOne({ email });
        const verifyRole = roles.map((role) => {
          if (user?.role.includes(role)) return true;
          else return false;
        });
        return verifyRole.every((e) => e === true)
          ? next()
          : res.status(401).send({ message: "Unauthorized access" });
      };
    }
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { id } = req.body;
      const item = await bookingsCollection.findOne({ _id: ObjectId(id) });
      const amount = item.resalePrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.get("/categories", async (req, res) => {
      const categories = await categoriesCollection.find({}).toArray();

      res.send(categories);
    });
    app.get("/products", verifyJWT, async (req, res) => {
      const query = req.query;
      let filter = {};
      if (query.categoryId) filter = { categoryId: query.categoryId };
      if (query.id) filter = { _id: ObjectId(query.id) };
      const products = await productsCollection.find(filter).toArray();
      res.send(products);
    });
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const userExist = await usersCollection.findOne({
        name: userInfo.name,
        email: userInfo.email,
      });
      if (userExist?.name || userExist?.email)
        return res.send({ acknowledged: true });
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    app.post("/user-authenticate", async (req, res) => {
      const { email, accountType } = req.body;
      const user = await usersCollection.findOne({ email });
      if (user?.role?.includes("admin")) return res.send(true);
      if (user?.role?.includes(accountType)) return res.send(true);
      return res.send(false);
    });
    app.get("/user", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded;
      const user = await usersCollection.findOne({ email: decodedEmail.email });
      res.send(user);
    });
    app.get("/user-authorize", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded;
      const query = req.query;
      const user = await usersCollection.findOne({ email: decodedEmail.email });
      if (query.isAdmin && decodedEmail.email === query.isAdmin) {
        const isAdmin = user.role.includes("admin");
        return res.send({ isAdmin });
      }
      if (query.isSeller && decodedEmail.email === query.isSeller) {
        const isSeller = user.role.includes("seller");
        return res.send({ isSeller });
      }
      return res.status(400).send({ message: "bad request" });
    });
    app.put("/user", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded;
      const updatedInfo = req.body;
      const filter = { email: decodedEmail.email };
      const updatedDoc = { $set: updatedInfo };
      const option = { upsert: true };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send(result);
    });
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const user = await usersCollection.findOne(email);
      if (user) {
        const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        return res.send({ token });
      }
      res.status(403).send({ accessToken: "" });
    });
    app.get("/bookings", verifyJWT, async (req, res) => {
      const query = req.query;
      let filter = {};
      if (query.id) filter = { _id: ObjectId(query.id) };
      const bookings = await bookingsCollection.find(filter).toArray();
      res.send(bookings);
    });
    app.put("/bookings", verifyJWT, async (req, res) => {
      const query = req.query;
      const decodedEmail = req.decoded;
      const { id, name, soldTo } = req.body;
      const filter = { _id: ObjectId(id), customerEmail: decodedEmail.email };
      let updatedDoc = {};
      const options = { upsert: true };
      let updateCollection = {};
      if (query.isPaid) {
        updatedDoc = { $set: { isPaid: true, soldTo } };
        updateCollection = await productsCollection.updateOne(
          {
            name,
          },
          {
            $set: { inStock: false, soldTo, customerEmail: decodedEmail.email },
          },
          options
        );
      }
      const result = await bookingsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send({ result1: result, result2: updateCollection });
    });
    app.get("/my-orders", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded;
      const query = { customerEmail: decodedEmail.email };
      const myOrders = await bookingsCollection.find(query).toArray();
      res.send(myOrders);
    });
    app.post("/bookings", verifyJWT, async (req, res) => {
      const { email } = req.decoded;
      const bookingInfo = req.body;
      if (bookingInfo.customerEmail !== email)
        return res.status(401).send({ message: "Unauthorized access." });
      const result = await bookingsCollection.insertOne(bookingInfo);
      res.send(result);
    });
    app.post("/products", verifyJWT, hasRoles(["seller"]), async (req, res) => {
      const productInfo = req.body;
      const result = await productsCollection.insertOne(productInfo);
      res.send(result);
    });
    app.put("/products", verifyJWT, async (req, res) => {
      const { id } = req.body;
      const query = req.query;
      const filter = { _id: ObjectId(id) };
      let updatedDoc = {};
      if (query.reported) updatedDoc = { $set: { isReported: true } };
      const options = { upsert: true };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.delete(
      "/products",
      verifyJWT,
      hasRoles(["admin"]),
      async (req, res) => {
        const { id } = req.body;
        const query = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(query);
        res.send(result);
      }
    );
    app.get(
      "/reported-items",
      verifyJWT,
      hasRoles(["admin"]),
      async (req, res) => {
        const query = { isReported: true };
        const reportedItems = await productsCollection.find(query).toArray();
        res.send(reportedItems);
      }
    );
    app.get("/my-buyers", verifyJWT, hasRoles(["seller"]), async (req, res) => {
      const { email } = req.decoded;
      const seller = await usersCollection.findOne({ email });
      const sellerCustomers = await productsCollection
        .find({ seller: seller.name, inStock: false })
        .toArray();
      res.send(sellerCustomers);
    });
    app.get(
      "/my-products",
      verifyJWT,
      hasRoles(["seller"]),
      async (req, res) => {
        const { email } = req.decoded;
        const seller = await usersCollection.findOne({ email });
        const sellerProducts = await productsCollection
          .find({ seller: seller.name })
          .toArray();
        res.send(sellerProducts);
      }
    );
    app.put(
      "/my-products",
      verifyJWT,
      hasRoles(["seller"]),
      async (req, res) => {
        const query = req.query;
        const productId = req.body._id;
        let filter = {};
        let updatedDoc = {};
        if (query.advertised === "true") {
          filter = { _id: ObjectId(productId) };
          updatedDoc = {
            $set: {
              advertised: true,
            },
          };
        }
        const optiion = { upsert: true };
        const result = await productsCollection.updateOne(
          filter,
          updatedDoc,
          optiion
        );
        res.send(result);
      }
    );
    app.get(
      "/all-sellers",
      verifyJWT,
      hasRoles(["admin"]),
      async (req, res) => {
        const query = {
          role: "seller",
        };
        const allSellers = await usersCollection.find(query).toArray();
        res.send(allSellers);
      }
    );
    app.get("/all-buyers", verifyJWT, hasRoles(["admin"]), async (req, res) => {
      const query = {
        role: "buyer",
      };
      const allBuyers = await usersCollection.find(query).toArray();
      res.send(allBuyers);
    });
    app.delete("/users", verifyJWT, hasRoles(["admin"]), async (req, res) => {
      const { id } = req.body;
      const user = await usersCollection.deleteOne({ _id: ObjectId(id) });
      res.send(user);
    });
    app.put("/users", verifyJWT, hasRoles(["admin"]), async (req, res) => {
      const query = req.query;
      const { id } = req.body;
      const filter = { _id: ObjectId(id) };
      let updatedDoc = {};
      const options = { upsert: true };
      if (query.verify) {
        updatedDoc = { $set: { isVerified: true } };
        const user = await usersCollection.findOne(filter);
        const userProducts = await productsCollection.updateMany(
          {
            seller: user.name,
          },
          updatedDoc,
          options
        );
      }

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
  } finally {
  }
}
run().catch((er) => console.error(er));
app.get("/", (req, res) => {
  res.send("Server is running");
});
app.listen(port, () => {
  console.log(`server is working on port ${port}`);
});
//test
// const token = jwt.sign(
//   { email: "test@email.com" },
//   process.env.ACCESS_TOKEN_SECRET,
//   {
//     expiresIn: "1d",
//   }
// );
// console.log(token);
