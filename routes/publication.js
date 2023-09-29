const express = require("express");
const router = express.Router();
const multer = require("multer");
const PublicacionController = require("../controllers/publication");
const check = require("../middlewares/auth");

// configuracion de subida
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads/publications/")
    },

    filename: (req, file, cb) => {
        cb(null, "pub-" + Date.now() + "-" + file.originalname)

    }
});

const uploads = multer({ storage });

//Definir rutas
router.get("/prueba-publication", PublicacionController.pruebaPublication);
router.post("/save", check.auth, PublicacionController.save);
router.get("/detail/:id", check.auth, PublicacionController.detail);
router.delete("/remove/:id", check.auth, PublicacionController.remove);
router.get("/user/:id/:page?", check.auth, PublicacionController.user);
router.post("/upload/:id", [check.auth, uploads.single("file0")], PublicacionController.upload);
router.get("/media/:file", PublicacionController.media);
router.get("/feed/:page?", check.auth, PublicacionController.feed);



//Exportar el ruter
module.exports = router;