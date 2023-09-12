import express from 'express';
import { crearSolicitud } from "../controllers/alumno.controller";

const router = express.Router();

router.post('/crearSolicitud', crearSolicitud);

export default router;