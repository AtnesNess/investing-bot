import fs from 'fs';

export function getDirectoryFiles(dirname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, function (err, files: string[]) {
            if (err) {
                return reject(err);
            }

            resolve(files);
        });
    });
};
