import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodEffects, ZodError } from 'zod';

type ValidationSchema = AnyZodObject | ZodEffects<AnyZodObject>;

export const validate = (schema: ValidationSchema) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if ('body' in parsed) req.body = parsed.body;
            if ('query' in parsed) req.query = parsed.query;
            if ('params' in parsed) req.params = parsed.params;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));

                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Validation failed',
                    errors,
                });
                return;
            }
            next(error);
        }
    };
};
