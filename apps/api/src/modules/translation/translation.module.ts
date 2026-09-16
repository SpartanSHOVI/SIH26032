import { Module } from '@nestjs/common';
import { TranslationController } from './translation.controller';

@Module({ controllers: [TranslationController] })
export class TranslationModule {}
