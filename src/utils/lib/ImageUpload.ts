import path from "path";
import fs from "fs";
import sharp from "sharp";
import { MulterRequest } from "../../defs/general.defs";
import { BreweryModel } from "../../models/brewery.model";
import { BeerModel } from "../../models/beer.model";

export async function imageUpload({ req }: { req: MulterRequest }) {
	const uploadPath = path.join(__dirname, "..", `uploads/`);
	if (!fs.existsSync(uploadPath)) {
		fs.mkdirSync(uploadPath, { recursive: true });
	}
	const ext: string =
		req.file && req.file.originalname
			? path.extname(req.file.originalname)
			: "";
	const newFileName = `CoverImage-${Date.now()}${ext}`;
	const uploadFilePathAndFile = path.join(uploadPath, newFileName);
	await sharp(req.file!.buffer)
		.webp({ lossless: true })
		.resize(800, 600, { fit: "cover" })
		.toFile(uploadFilePathAndFile);
	const relativeUploadFilePathAndFile = `/uploads/${newFileName}`;
	return relativeUploadFilePathAndFile;
}

export async function deleteCoverImageData({
	id,
	coverImagePath,
	type
}: {
	id: string;
	coverImagePath: string;
	type: 'beer' | 'brewery'
}) {
	const filePath = path.join(__dirname, "..", coverImagePath);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
	let result = null
	if(type === 'brewery') {
		result = await BreweryModel.nullCoverImage(id)
	}
	if(type === 'beer') {
		result = await BeerModel.nullCoverImage(id)
	}
	
	if (result === null || result.rowCount === 0) {
		throw new Error()
	}
	return result
}
