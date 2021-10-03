import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Coerce } from '../utils/coerce.util';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dtos/create-account.dto';
import { UpdateAccountDto } from './dtos/update-account.dto';

/**
 * CRUD operations on Account data.
 * @class AccountController
 */
@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'A list of all account records.' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'The requested Account.' })
  @ApiResponse({ status: 404, description: 'Account Id not found.' })
  async findOne(@Param('id') id: string, @Query('refresh') refresh: boolean) {
    if (Coerce.boolean(refresh)) {
      await this.service.manuallyExecuteOnLogin(id);
    }
    return await this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 200, description: 'Account created.' })
  @ApiResponse({ status: 400, description: 'Bad request made.' })
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.service.create(createAccountDto);
  }

  @Post('/clear/:id')
  @ApiResponse({ status: 200, description: 'Account data cleared.' })
  @ApiResponse({ status: 400, description: 'Bad request made.' })
  async clear(@Param('id') id: string) {
    await this.service.clearAccountData(id);
    return this.service.manuallyExecuteOnLogin(id);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, description: 'Account updated.', type: Boolean })
  @ApiResponse({ status: 404, description: 'Account Id not found.' })
  update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.service.update(id, updateAccountDto);
  }

  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully.',
    type: Boolean,
  })
  @ApiResponse({ status: 404, description: 'Account Id not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
